/**
 * Count schematics in R2 bucket
 *
 * Usage: npx tsx scripts/count-r2-schematics.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function countSchematics() {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error("Missing R2_BUCKET_NAME");
  }

  console.log("Counting schematics in R2...\n");

  let totalCount = 0;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "schematics/",
      ContinuationToken: continuationToken,
    });

    const response = await client.send(command);

    if (response.Contents) {
      totalCount += response.Contents.length;
      console.log(`Fetched ${response.Contents.length} objects (total so far: ${totalCount})`);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log("\n" + "=".repeat(50));
  console.log(`Total schematics in R2: ${totalCount}`);
  console.log("=".repeat(50));

  if (totalCount < 4301) {
    console.log(`\n⚠️  Expected 4301, missing ${4301 - totalCount} schematics`);
  } else if (totalCount === 4301) {
    console.log("\n✅ All 4301 schematics present!");
  } else {
    console.log(`\n📈 More than expected: ${totalCount - 4301} extra schematics`);
  }
}

countSchematics().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
