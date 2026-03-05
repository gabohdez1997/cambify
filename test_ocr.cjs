const fs = require('fs');
const https = require('https');

// Read .env
const envContent = fs.readFileSync('c:/Users/Gabri/Desktop/Cambify/.env', 'utf8');
const match = envContent.match(/GOOGLE_VISION_API_KEY=(.*)/);
let apiKey = match ? match[1].trim() : null;

// Remove surrounding quotes if they exist
if (apiKey.startsWith('"') && apiKey.endsWith('"')) {
    apiKey = apiKey.slice(1, -1);
} else if (apiKey.startsWith("'") && apiKey.endsWith("'")) {
    apiKey = apiKey.slice(1, -1);
}

if (!apiKey) {
    console.error('No API key found in .env');
    process.exit(1);
}

console.log("Testing with API Key:", apiKey.substring(0, 10) + "...");

const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjEuNWRHWFIAAAHNSURBVHhe7ZM9y8JAEIbn/wy/QOxELBQsrLQRwc7CwkJRCxtBEcHGwg+wkLQQtNC/EfwJFgqiCIKNgoUgFgr+ALXQn11G1s1lM7uZvfHBA8Nmk7vZe29mXfL5fF5C2w+Q0QOQ0QOQ0QOQ0QOQoQOQeDwe5XK5XJZKpdL5fC61Wi2r1+tZp9OxyWSiQwiHw1mr1QrhcNhGo1HW7/d1CPE8gOFwKOFwWMc2NBoNiUajOrZhNptJu93WsQ2z2Uzq9bqObXg8HnK5XHRsw2AwUHEjB7BardT3tZ6Xy+Wf99gWlUolnU7H5nK5LBaLiTHGJBKJrNVqeTxgvV5LrVYjx/B5B5jP51kqlSLH8HkHoL+bTCY6tmEymYhZ4Hg8FjPGpFAo6BBisVjWaDRCOBzWoQ04l0KhIPF4XIc27P0nEA2HwzrEDzz2XwCwWq0kEonoED/w2A8Acx/nBzz2BMAcx/kFj/0AsBtxfsJjdwBYwjg/4bEbAIKxI34t0e1+2Q0AyXgj4XG/7AaAJLyR8LhfdgNAIt5QeNwvuwEgAW8sPO6X3QBgxBsOjwHg+wMAI94MeAwA3x+AMt4ceAwA3x+Act4keAwA3x8AEt4seAwA3x8AMt40eAwAQ9sfAAnvETwe/gN/8B7Bo2QvAQAAAABJRU5ErkJggg==';

const payload = JSON.stringify({
    requests: [
        {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }]
        }
    ]
});

const options = {
    hostname: 'vision.googleapis.com',
    path: '/v1/images:annotate?key=' + apiKey,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);
    });
});

req.on('error', (e) => {
    console.error('Request Error:', e);
});

req.write(payload);
req.end();
