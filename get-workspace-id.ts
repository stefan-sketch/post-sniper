import fetch from "node-fetch";

const PUBLER_API_KEY = process.env.PUBLER_API_KEY || "838f5909c0dbb6a197bb7daeae8aca46da61827dc8e1d256";

console.log("Fetching Publer Workspace ID...\n");
console.log("API Key:", PUBLER_API_KEY ? `${PUBLER_API_KEY.substring(0, 10)}...${PUBLER_API_KEY.substring(PUBLER_API_KEY.length - 4)}` : "NOT SET");
console.log("\n" + "=".repeat(60) + "\n");

async function getWorkspaceId() {
  try {
    // Get workspaces - this endpoint doesn't require Publer-Workspace-Id header
    console.log("Fetching workspaces...");
    const workspacesResponse = await fetch("https://app.publer.com/api/v1/workspaces", {
      method: "GET",
      headers: {
        "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
      },
    });

    console.log("Status:", workspacesResponse.status, workspacesResponse.statusText);
    
    if (!workspacesResponse.ok) {
      const errorText = await workspacesResponse.text();
      console.error("\n❌ Error:", errorText);
      console.log("\n" + "=".repeat(60));
      console.log("TROUBLESHOOTING:");
      console.log("=".repeat(60));
      console.log("1. Make sure your API key is valid and active");
      console.log("2. Verify you have a Business plan (API requires Business plan)");
      console.log("3. Check that the 'workspaces' scope is enabled for your API key");
      console.log("4. Generate a new API key at: https://app.publer.com/settings");
      console.log("   Go to Settings → Access & Login → API Keys");
      return;
    }

    const workspacesData = await workspacesResponse.json();
    
    // Check if we got an array
    if (!Array.isArray(workspacesData)) {
      console.log("\nUnexpected response format:");
      console.log(JSON.stringify(workspacesData, null, 2));
      return;
    }

    if (workspacesData.length === 0) {
      console.log("\n⚠️  No workspaces found for this API key.");
      console.log("Make sure you have at least one workspace in your Publer account.");
      return;
    }

    // Display workspaces
    console.log("\n" + "=".repeat(60));
    console.log("✅ WORKSPACES FOUND:");
    console.log("=".repeat(60));
    
    workspacesData.forEach((workspace: any, index: number) => {
      console.log(`\n${index + 1}. ${workspace.name || 'Unnamed Workspace'}`);
      console.log(`   Workspace ID: ${workspace.id || workspace._id}`);
      console.log(`   Plan: ${workspace.plan || 'N/A'}`);
      console.log(`   Owner: ${workspace.owner?.name || workspace.owner?.email || 'N/A'}`);
      if (workspace.picture) {
        console.log(`   Picture: ${workspace.picture}`);
      }
    });
    
    console.log("\n" + "=".repeat(60));
    console.log("\n📋 NEXT STEPS:");
    console.log("=".repeat(60));
    console.log("1. Copy the 'Workspace ID' from above");
    console.log("2. Update your environment variable:");
    console.log(`   PUBLER_WORKSPACE_ID=${workspacesData[0].id || workspacesData[0]._id}`);
    console.log("\n3. If you have multiple workspaces, choose the one you want to use");
    console.log("   and copy its ID instead.");
    console.log("\n" + "=".repeat(60));

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
  }
}

getWorkspaceId();

