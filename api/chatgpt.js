const axios = require('axios');
const crypto = require('crypto');

const verificationToken = process.env.LARK_VERIFICATION_TOKEN;
const encryptKeyBase64 = process.env.LARK_ENCRYPT_KEY;

function decryptEncrypt(encryptKeyBase64, encrypt) {
  try {
    let keyBase64 = encryptKeyBase64;
    while (keyBase64.length % 4 !== 0) {
      keyBase64 += '=';
    }
    const key = Buffer.from(keyBase64, 'base64');
    const iv = key.slice(0, 16);
    const encryptedData = Buffer.from(encrypt, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedData, null, 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('Decrypt error:', err);
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Request body:', req.body);

    if (req.body.challenge) {
      // Nếu có challenge plain thì trả về luôn (trường hợp chưa bật mã hóa)
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ challenge: req.body.challenge });
    }

    if (!req.body.encrypt) {
      return res.status(400).json({ message: 'Missing encrypt field' });
    }

    const decrypted = decryptEncrypt(encryptKeyBase64, req.body.encrypt);

    console.log('Decrypted payload:', decrypted);

    if (decrypted.challenge) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ challenge: decrypted.challenge });
    }

    const userMessage = decrypted?.event?.text || decrypted?.message?.text || '';

    if (!userMessage) {
      return res.status(400).json({ message: 'No user message found' });
    }

    // Gọi OpenAI
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const reply = openaiRes.data.choices[0].message.content;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      msg_type: 'text',
      content: { text: reply },
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message || error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
