const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const userMessage = body?.event?.text || body?.message?.text || '';

    if (!userMessage) {
      return res.status(400).json({ message: 'No user message found' });
    }

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

    return res.json({
      msg_type: 'text',
      content: { text: reply },
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ message: 'OpenAI API error' });
  }
};
