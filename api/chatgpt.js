const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const body = req.body;
  console.log('Request body:', body);

  // Xử lý challenge webhook từ Lark
  if (body.challenge) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ challenge: body.challenge });
  }

  try {
    // Lấy tin nhắn user (có thể thay đổi tùy payload thực tế)
    const userMessage = body?.event?.text || body?.message?.text || '';

    if (!userMessage) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ message: 'No user message found' });
    }

    // Gọi OpenAI ChatGPT API
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
    console.error('OpenAI API error:', error.response?.data || error.message);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ message: 'OpenAI API error' });
  }
};
