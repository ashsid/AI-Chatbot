const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const openaiInstance = new OpenAI({
  apiKey: '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'// This is also the default, can be omitted
});

let knowledgeBase = [];

async function extractTextFromPDFBuffer(pdfBuffer) {
    const data = await pdfParse(pdfBuffer);
    return data.text;
}

async function addPDFToKnowledgeBase(pdfBuffer) {
    console.log("Adding PDF embedding to database")
    const pdfText = await extractTextFromPDFBuffer(pdfBuffer);
    const embedding = await getEmbedding(pdfText);
    knowledgeBase.push({ text: pdfText, embedding });
}

async function getEmbedding(text) {
    const response = await openaiInstance.embeddings.create({
        model: 'text-embedding-ada-002',
        input: [text],
        temperature: 0.9,
        max_tokens: 150,
    });
    console.log(response.data[0].embedding);
    return response.data[0].embedding;
}

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('add pdf', async (pdfBuffer) => {
        await addPDFToKnowledgeBase(pdfBuffer);
        io.emit('chat message', { user: 'AI', message: 'PDF added to knowledge base.' });
    });

    socket.on('chat message', async (msg) => {
        io.emit('chat message', { user: 'User', message: msg });

        try {
            const queryEmbedding = await getEmbedding(msg);
            const mostSimilarText = findMostSimilarText(queryEmbedding);
            io.emit('chat message', { user: 'AI', message: mostSimilarText });
        } catch (error) {
            console.error('Error processing query:', error.message);
            io.emit('chat message', { user: 'AI', message: 'Error processing query.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vectorA, vectorB) {
    const dotProduct = vectorA.reduce((acc, val, i) => acc + val * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((acc, val) => acc + val ** 2, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((acc, val) => acc + val ** 2, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0; // Avoid division by zero
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

// Function to find the most similar text in the knowledge base
function findMostSimilarText(queryEmbedding) {
    let mostSimilarText = '';
    let maxSimilarity = -1;

    knowledgeBase.forEach((item) => {
        const similarity = cosineSimilarity(queryEmbedding, item.embedding);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            mostSimilarText = item.text;
        }
    });

    return mostSimilarText;
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

