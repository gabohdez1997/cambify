import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';

// Since Vercel edge/serverless can have issues with the @google-cloud/vision Node SDK
// (which relies on native gRPC binaries), we will instead use the direct REST API approach.
// That is much safer for SvelteKit on Vercel.

export async function POST({ request, locals }: RequestEvent) {
    // 1. Authenticate user
    const session = await locals.getSession();
    if (!session) {
        return json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { imageBase64 } = await request.json();

        if (!imageBase64) {
            return json({ error: 'No se envió ninguna imagen' }, { status: 400 });
        }

        // Clean up base64 string if it contains the data URI prefix
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        // 2. Prepare Google Vision REST API Call
        let googleApiKey = "";

        if (env.GOOGLE_VISION_API_KEY) {
            googleApiKey = env.GOOGLE_VISION_API_KEY;
        } else {
            // Let's try to extract standard API KEY from the Service Account JSON if they uploaded that instead
            if (env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                try {
                    const creds = JSON.parse(env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                    if (creds && typeof creds === 'string' && !creds.client_email) {
                        // Sometimes users just paste an actual simple API KEY into the JSON var by mistake. Let's handle it graciously.
                        googleApiKey = creds;
                    }
                } catch (e) { }
            }
        }

        // If we STILL don't have a simple API key, we have a problem. The REST API usually requires a simple API Key, not a full Service Account JSON.
        // To use a service account with the REST API we'd need to generate an OAuth2 token manually, which is complex.
        // So the user MUST provide an API_KEY.

        if (!googleApiKey) {
            return json({ error: 'No se ha configurado GOOGLE_VISION_API_KEY. Ve a Vercel y añade una clave de API simple (no el JSON entero) en la variable GOOGLE_VISION_API_KEY.' }, { status: 500 });
        }

        const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${googleApiKey}`;

        const requestPayload = {
            requests: [
                {
                    image: { content: base64Data },
                    features: [{ type: 'TEXT_DETECTION' }]
                }
            ]
        };

        const response = await fetch(visionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google Vision API REST Error:", data);
            return json({ error: `La API de Google rechazó la solicitud: ${data.error?.message || response.statusText}` }, { status: 500 });
        }

        const detections = data.responses?.[0]?.textAnnotations;

        if (!detections || detections.length === 0) {
            return json({ error: 'No se detectó texto en la imagen. Intenta con otra captura.' }, { status: 400 });
        }

        // The first element contains the entire text block
        const fullText = detections[0].description || "";

        console.log("Extracted OCR Text:\n", fullText); // Good for debugging server-side

        // 3. Extract Data using Regex
        let amount = "";
        let reference = "";

        // Common patterns for Venezuelan Bank Transfers (Pago Movil / Transferencia)

        // --- Referencia ---
        const refRegex = /(?:[rR]ef(?:erencia)?[:\s-]*|operaci(?:o|ó)n[:\s-]*|recibo[:\s-]*)?(\b\d{6,15}\b)/i;
        const refMatch = fullText.match(refRegex);
        if (refMatch && refMatch[1]) {
            reference = refMatch[1];
        } else {
            // Fallback: Just try to find a long number that looks like a reference if the word "Ref" isn't strictly attached
            const looseRefRegex = /\b(\d{7,15})\b/;
            const looseMatch = fullText.match(looseRefRegex);
            if (looseMatch) {
                reference = looseMatch[1];
            }
        }

        // --- Monto ---
        // Amount often format is "1.500,00" or "1,500.00" or just "1500" often near "Bs", "VED", "VES", "Monto"
        const amountRegex = /(?:Bs[\.\s]*|VES[\s]*|Monto[:\s]*\$?)(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{1,2})?)/i;
        const amountMatch = fullText.match(amountRegex);

        if (amountMatch && amountMatch[1]) {
            // Need to convert "1.500,00" to JS number "1500.00"
            let rawAmount = amountMatch[1];

            if (rawAmount.includes('.') && rawAmount.includes(',')) {
                if (rawAmount.lastIndexOf(',') > rawAmount.lastIndexOf('.')) {
                    // Venezuelan: comma is decimal
                    rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
                } else {
                    // US: period is decimal
                    rawAmount = rawAmount.replace(/,/g, '');
                }
            } else if (rawAmount.includes(',')) {
                rawAmount = rawAmount.replace(',', '.');
            }

            amount = parseFloat(rawAmount).toString();
            if (isNaN(parseFloat(amount))) amount = "0";
        }

        return json({
            success: true,
            extracted: {
                amount,
                reference,
                rawText: fullText
            }
        });

    } catch (e: any) {
        console.error("Internal OCR Server Error Details:", e);
        return json({ error: `Ha ocurrido un error interno en el servidor SvelteKit: ${e.message}` }, { status: 500 });
    }
}
