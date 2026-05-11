const REPLICATE_API_URL = "/api/replicate";

export async function generateImage(prompt) {
  try {
    console.log("Sending Replicate request through server API...");

    const response = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt,
        version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
        input: {
          prompt,
          num_outputs: 1,
          scheduler: "K_EULER",
          num_inference_steps: 50,
          guidance_scale: 7.5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Replicate request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Replicate API error:", error);
    throw error;
  }
}

export async function checkPredictionStatus(predictionId) {
  try {
    const response = await fetch(`${REPLICATE_API_URL}?id=${encodeURIComponent(predictionId)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Replicate status request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Replicate status check error:", error);
    throw error;
  }
}
