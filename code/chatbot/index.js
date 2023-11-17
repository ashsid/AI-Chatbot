const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: 'your api key'// This is also the default, can be omitted
});
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('chat message', async (msg) => {
        io.emit('chat message', { user: 'User', message: msg });

        try {
            const aiResponse = await getOpenAIResponse(msg);
            io.emit('chat message', { user: 'AI', message: aiResponse });
        } catch (error) {
            console.error('Error fetching OpenAI response:', error.message);
            io.emit('chat message', { user: 'AI', message: 'Error fetching AI response.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

async function getOpenAIResponse(userMessage) {
    const prompt = `User: ${userMessage}\nAI: `;

    try {
        const response = await openai.completions.create({
            model: "text-davinci-003",
            temperature: 0.9,
            max_tokens: 150,
        });
        const generatedText = response.choices[0].text.trim();
        console.log(generatedText)
        return generatedText;
    } catch (error) {
        throw error;
    }
}
