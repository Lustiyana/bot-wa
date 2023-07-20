const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const fs = require("fs");
const puppeteer = require("puppeteer");
const tf = require("@tensorflow/tfjs");
const jpeg = require("jpeg-js");
const { createCanvas, loadImage } = require("canvas");
const express = require("express");
const request = require("request");
const FormData = require("form-data");
const { Blob } = require("buffer");
const path = require("path");

// Connect to WhatsApp Web
const app = express();

app.use(express.static("public"));

app.listen(3001, () => {
  // Initialize WhatsApp client
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "auth" }),
  });

  // Generate QR code for authentication
  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
  });

  // Log message when client is ready
  client.on("ready", () => {
    console.log("WhatsApp bot ready");
  });

  // Function to convert base64 string to Blob object
  function base64ToBlob(base64String, mimeType) {
    const byteCharacters = Buffer.from(base64String, "base64").toString("utf8");
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    return blob;
  }

  // Handle incoming messages with media files
  client.on("message", async (msg) => {
    if (msg.body === "hai") {
      msg.reply("Hai ada yang bisa dibantu");
    }
    if (msg.hasMedia) {
      const media = (await msg.downloadMedia()) || {
        mimetype: "image/png",
        data: "",
      };

      const date = new Date();
      const getYear = date.getFullYear();
      const getMonth = date.getMonth();
      const getDate = date.getDate();
      const getHours = date.getHours();
      const getMinutes = date.getMinutes();
      const getSeconds = date.getSeconds();
      const getMilliseconds = date.getMilliseconds();
      const formData = new FormData();
      const blob = base64ToBlob(media.data, media.mimetype);
      const buffer = Buffer.from(media.data, "base64");
      const datURL = `data:${media.mimetype};base64,${buffer.toString(
        "base64"
      )}`;
      const ext = media.mimetype.split("/")[1];

      formData.append("image", Buffer.from(media.data, "base64"), {
        filename: `${getYear}-${getMonth}-${getDate}-${getHours}-${getMinutes}-${getSeconds}-${getMilliseconds}.${ext}`,
        contentType: media.mimetype,
        knownLength: media.size,
      });

      axios
        .post("https://mtcnn.lustiyana18.my.id/process", formData)
        .then(async (res) => {
          console.log(res.data);
          try {
            axios
              .post("https://strapi.lustiyana18.my.id/api/attendances", {
                data: {
                  name: res.data.prediction,
                  status: true,
                },
              })
              .then(() => {
                msg.reply(
                  `Selamat! ${res.data.prediction} telah melakukan absen`
                );
                // msg.reply("Media berhasil diunggah ke API");
                // msg.reply("Berhasil melakukan absen");
              })
              .catch((respErr) => {
                console.log("RESP ERRPR: ", respErr.response.data);
              });
          } catch (err) {
            console.log(err);
          }
        })
        .catch((err) => {
          console.log(err);
        });
    }
  });

  // async function getClasses() {
  //   const dataClasses = await axios.get(
  //     "https://strapi.lustiyana18.my.id/api/users?sort[0]=name"
  //   );

  //   return dataClasses;
  // }

  client.initialize();

  console.log("App listen in port: 3001");
});
