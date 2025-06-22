export const fetchStreamingResponse = async (
  userMessage: string,
  onChunkReceived: (chunk: string) => void
): Promise<void> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/chatbot/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      }
    );

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      onChunkReceived(chunk);
    }
  } catch (error) {
    console.error("Error fetching chatbot response:", error);
    onChunkReceived("Sorry, something went wrong.");
  }
};
