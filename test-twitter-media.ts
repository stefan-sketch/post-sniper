const TWITTER_API_KEY = "new1_37cf0aac566b4abda3b0c2d34f1729af";
const TWITTER_LIST_ID = "1750840026051596582";

async function testTwitterMedia() {
  try {
    const url = new URL("https://api.twitterapi.io/twitter/list/tweets");
    url.searchParams.append("listId", TWITTER_LIST_ID);
    
    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": TWITTER_API_KEY,
      },
    });

    const data = await response.json();
    const tweetWithMedia = data.tweets?.find((t: any) => t.entities?.media || t.media);
    
    if (tweetWithMedia) {
      console.log("Tweet with media found:");
      console.log("entities.media:", JSON.stringify(tweetWithMedia.entities?.media, null, 2));
      console.log("media:", JSON.stringify(tweetWithMedia.media, null, 2));
    } else {
      console.log("No tweets with media found");
      console.log("First tweet structure:", JSON.stringify(data.tweets?.[0], null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testTwitterMedia();
