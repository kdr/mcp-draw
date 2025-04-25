#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { parseArgs } from "util";
import { v4 as uuidv4 } from "uuid";

// Parse command line arguments
const { values: args } = parseArgs({
  options: {
    "api-key": {
      type: "string",
    },
    "output-dir": {
      type: "string",
    },
  },
});

const openai = new OpenAI({
  apiKey: args["api-key"] || process.env.OPENAI_API_KEY,
});

// Create server instance
const server = new McpServer({
  name: "mcp-draw",
  version: "0.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register all tools
export const schema = {
  description: z
    .string()
    .describe("Description of what the image should look like"),
};

server.tool(
  "generate_image_from_description",
  "Generates an image from a description of what the image should look like, saves to local file hose path is returned",
  schema,
  async ({ description }) => {
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: description,
    });

    // Save the image to a file
    if (result.data && result.data.length > 0 && result.data[0].b64_json) {
      const image_base64 = result.data[0].b64_json;
      const image_bytes = Buffer.from(image_base64, "base64");

      // Create output directory if it doesn't exist
      const outputDir = args["output-dir"] || process.cwd();
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate unique filename
      const filename = `${uuidv4()}.png`;
      const filePath = path.join(outputDir, filename);

      // Save the image
      fs.writeFileSync(filePath, image_bytes);

      return {
        content: [
          {
            type: "text",
            text: path.resolve(filePath),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: "Unable to create comic",
        },
      ],
    };
  },
);

// Run server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Text in LLM running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
