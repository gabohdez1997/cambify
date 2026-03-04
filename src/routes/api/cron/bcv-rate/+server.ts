import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import * as cheerio from 'cheerio';
import https from 'https';

function fetchBcvHtml(): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get('https://www.bcv.org.ve/', {
            rejectUnauthorized: false, // Bypass BCV's SSL certificate issues
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            }
        }, (res) => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                return reject(new Error(`BCV Website responded with status: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

export async function GET({ url }) {
    // We allow fetching via GET to easily set it up with cron-job.org
    // Optional: secure the cron route with a simple token query param if needed
    // const token = url.searchParams.get('token');
    // if (token !== 'MY_CRON_SECRET') return json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        // Today's Date in Venezuela (UTC-4)
        // Ensure we are comparing dates correctly
        const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
        const todayDateStr = formatter.format(new Date());

        // 1. Check if we ALREADY have the rate for today in Supabase
        const { data: existingRate, error: dbCheckError } = await supabaseAdmin
            .from('exchange_rates')
            .select('*')
            .eq('date', todayDateStr)
            .maybeSingle();

        if (existingRate) {
            return json({
                message: 'Rate already exists for today',
                source: 'database',
                rate: existingRate.ves_to_usd,
                date: existingRate.date
            });
        }

        // 2. We don't have it, let's scrape the BCV
        console.log("Fetching new rate from BCV.org.ve...");

        const html = await fetchBcvHtml();
        const $ = cheerio.load(html);

        // The USD rate in BCV is usually in a div with ID 'dolar'
        // Example structure: <div id="dolar"><div>...</div><div> <strong> 36,32 </strong> </div></div>
        const rawUsdValue = $('#dolar strong').text().trim();

        if (!rawUsdValue) {
            throw new Error('Could not parse USD rate from BCV HTML page. Structure might have changed.');
        }

        // Parse format "36,23450000" to Float
        const vesToUsd = parseFloat(rawUsdValue.replace(',', '.'));

        if (isNaN(vesToUsd)) {
            throw new Error(`Failed to convert parsed string to float: ${rawUsdValue}`);
        }

        // 3. Save it to Supabase
        const { data: insertedRate, error: insertError } = await supabaseAdmin
            .from('exchange_rates')
            .insert([{
                date: todayDateStr,
                ves_to_usd: vesToUsd
            }])
            .select()
            .single();

        if (insertError) {
            // If unique constraint failed because a parallel process just inserted it, it's fine
            if (insertError.code === '23505') {
                return json({ message: 'Rate was concurrently inserted by another process.' });
            }
            throw new Error(`Supabase Insert Error: ${insertError.message}`);
        }

        return json({
            message: 'Successfully fetched and saved BCV rate',
            source: 'bcv_scraped',
            rate: insertedRate.ves_to_usd,
            date: insertedRate.date
        });

    } catch (err: any) {
        console.error("BCV Fetch Error:", err);
        return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
