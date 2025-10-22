const TWITTER_API_KEY = "new1_37cf0aac566b4abda3b0c2d34f1729af";
const TWITTER_LIST_ID = "1750840026051596582";

async function testTwitterAPI() {
  try {
    const response = await fetch(
      `https://api.twitterapi.io/v1/lists/${TWITTER_LIST_ID}/tweets`,
      {
        headers: {
          "Authorization": `Bearer ${TWITTER_API_KEY}`,
        },
      }
    );

    console.log("Status:", response.status);
    console.log("Status Text:", response.statusText);
    
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

testTwitterAPI();
