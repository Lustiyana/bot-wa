const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const fs = require("fs");
const puppeteer = require("puppeteer");
const tf = require("@tensorflow/tfjs");
// require("@tensorflow/tfjs-node");
const jpeg = require("jpeg-js");
const { createCanvas } = require("@napi-rs/canvas");
const express = require('express');

// Connect to WhatsApp Web

const app = express()

app.use(express.static('public'))

app.listen(3000, () => {
  // Initialize WhatsApp client
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "auth" }),
  });
  
  // Generate QR code for authentication
  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
  });
  
  client.on('')
  // // Log message when client is ready
  client.on("ready", () => {
    console.log("WhatsApp bot ready");
  });
  
  // Function to convert base64 string to Blob object
  function base64ToBlob(base64String, mimeType) {
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
  
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
  
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
  
    return blob;
  }
  
  // const model = tf.loadLayersModel("tfjs_model/model.json");
  
  // Handle incoming messages with media files
  client.on("message", async (msg) => {
    if (msg.body === "hai") {
      msg.reply("Hai ada yang bisa dibantu");
    }
    if (msg.hasMedia) {
      console.log("Received media: " + msg.body);
      const media = await msg.downloadMedia();
      
      const predictedImage = await predictImage(media)

      console.log(predictedImage)
      // // Get image classification prediction with TF.js
      // const result = await predictImage(media);
  
      // // Prepare data for API upload
      // const date = new Date();
      // const getYear = date.getFullYear();
      // const data = new FormData();
      // data.append("image", media.toJpeg(), { filename: "image.jpg" });
      // data.append("prediction", result, { filename: "prediction.txt" });
      // data.append("tags", `${getYear},TF.js,image classification`, {
      //   filename: "tags.txt",
      // });
  
      // // Upload data to API
      // const apiResponse = await axios.post(
      //   "https://example.com/api/upload",
      //   data
      // );
  
      // // Reply with API response
      // msg.reply(apiResponse.data);
    }
  });
  
  // Function to get image classification prediction with TF.js
  async function predictImage(media) {
    // Load image data into TensorFlow.js tensor
    const imageRaw = jpeg.decode(media.data, true);
    const image = tf.browser.fromPixels(createCanvas(imageRaw));
    const input = tf.expandDims(image);
  
    // Load TensorFlow.js model
    const model = await tf.loadLayersModel(
      "http://localhost:3000/tfjs_model/model.json"
    );
  
    // Make prediction and return result
    const prediction = model.predict(input);
    const predictionData = await prediction.data();
    const result = predictionData.reduce((acc, val, index) => {
      return val > predictionData[acc] ? index : acc;
    }, 0);
  
    return result;
  }


  client.initialize();

  console.log("App listen in port: 3000")

})
