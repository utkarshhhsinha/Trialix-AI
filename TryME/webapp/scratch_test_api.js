const apiKey = 'AIzaSyB9EuogsWeMNyBRFAQi_6rIa4D1rL_Z56Y';
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;

const body = {
  contents: [{
    role: 'user',
    parts: [
      { text: 'Say hello' }
    ]
  }]
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})
.then(res => res.json().then(data => ({ status: res.status, data })))
.then(res => console.log('Response:', JSON.stringify(res, null, 2)))
.catch(err => console.error('Error:', err));
