const TWITTER_API_KEY = "new1_37cf0aac566b4abda3b0c2d34f1729af";
const TWITTER_LIST_ID = "1750840026051596582";

async function testTwitterAPI() {
  try {
    const url = new URL("https://api.twitterapi.io/twitter/list/tweets");
    url.searchParams.append("listId", TWITTER_LIST_ID);
    
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": TWITTER_API_KEY,
      },
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Tweets found:", data.tweets?.length || 0);
    if (data.tweets?.length > 0) {
      console.log("First tweet author:", data.tweets[0].author?.name);
      console.log("First tweet text:", data.tweets[0].text?.substring(0, 100));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testTwitterAPI();
