import dotenv from "dotenv";
dotenv.config();

async function run() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-5.5",
      temperature: 1,
      max_completion_tokens: 2000,
      messages: [{ role: "user", content: "test" }]
    })
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
