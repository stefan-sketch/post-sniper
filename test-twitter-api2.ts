const TWITTER_API_KEY = "new1_37cf0aac566b4abda3b0c2d34f1729af";
const TWITTER_LIST_ID = "1750840026051596582";

async function testTwitterAPI() {
  try {
    const url = new URL("https://api.twitterapi.io/twitter/list/tweet");
    url.searchParams.append("list_id", TWITTER_LIST_ID);
    
    console.log("URL:", url.toString());
    
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": TWITTER_API_KEY,
      },
    });

    console.log("Status:", response.status);
    console.log("Status Text:", response.statusText);
    
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

testTwitterAPI();
