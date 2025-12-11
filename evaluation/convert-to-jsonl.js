#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert responses.json to JSONL format for Azure AI Evaluation SDK
 * Extracts relevant fields for each evaluation metric
 */

function convertToJSONL() {
  const responsesPath = path.join(__dirname, "responses.json");
  const jsonlPath = path.join(__dirname, "evaluation_data.jsonl");

  const responses = JSON.parse(fs.readFileSync(responsesPath, "utf-8"));

  let jsonlContent = "";

  responses.forEach((resp) => {
    const query = resp.query_description;
    const response = JSON.stringify(resp.response);
    const queryType = resp.query_type;
    const success = resp.passed;

    // Create evaluation record
    const record = {
      query_id: resp.query_id,
      query_type: queryType,
      query: query,
      response: response,
      ground_truth: success ? "success" : "failure",
      success: success ? "yes" : "no",
    };

    jsonlContent += JSON.stringify(record) + "\n";
  });

  fs.writeFileSync(jsonlPath, jsonlContent);
  console.log(`✅ Converted to JSONL format: ${jsonlPath}`);
  console.log(`   Total records: ${responses.length}`);
}

convertToJSONL();
