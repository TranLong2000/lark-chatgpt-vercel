const crypto = require('crypto');
const axios = require('axios');

const verificationToken = process.env.LARK_VERIFICATION_TOKEN;
const encryptKeyBase64 = process.env.LARK_ENCRYPT_KEY; // base64 string

function decryptEncrypt(encrypt) {
  // Giải mã encrypt_key base64
  const encryptKey = Buffer.from(encryptKeyBase64 + '=', 'base64'); // thêm '=' nếu thiếu padding

  // IV là 16 byte đầu của key
  const iv = encryptKey.slice(0, 16);

  // Data mã hóa base64 decode
  const encryptedData = Buffer.from(encrypt, 'base64');

  // Tạo decipher AES-256-CBC
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptKey, iv);

  let decrypted = decipher.update(encryptedData, null, 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body;

    if (!body.encrypt) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ message: 'Missing encrypt field' });
    }

    // Giải mã payload
    const decrypted = decryptEncrypt(body.encrypt);
    console.log('Decrypted payload:', decrypted);

    // Xử lý challenge webhook
    if (decrypted.challenge) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ challenge: decrypted.challenge });
    }

    const userMessage = decrypted?.event?.text || decrypted?.message?.text || '';
    if (!userMessage) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ message: 'No user message found' });
    }

    // Gọi OpenAI API
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
