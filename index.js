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
      const name = media.mimetype.split("/")[0];
      const ext = media.mimetype.split("/")[1];

      formData.append("image", Buffer.from(media.data, "base64"), {
        filename: `${getYear}-${getMonth}-${getDate}-${getHours}-${getMinutes}-${getSeconds}-${getMilliseconds}.${ext}`,
        contentType: media.mimetype,
        knownLength: media.size,
      });

      axios
        .post("http://127.0.0.1:8001/process", formData)
        .then(async (res) => {
          console.log(res.data.image);

          try {
            const predictedImage = await predictImage(
              `http://127.0.0.1:8001${res.data.image}`
            );

            console.log("Predicted Image: ", predictedImage);

            axios
              .post("http://18.143.172.4:1337/api/attendances", {
                data: {
                  // image: imageId,
                  name: predictedImage.name,
                  status: true,
                },
              })
              .then(() => {
                msg.reply("Media berhasil diunggah ke API");
                msg.reply("Berhasil melakukan absen");
              })
              .catch((respErr) => {
                console.log("RESP ERRPR: ", respErr.response.data);
              });
          } catch (err) {
            console.log(err);
          }
          // axios
          //   .post("http://18.143.172.4:1337/api/upload", formData)
          //   .then(async (res) => {
          //     const imageId = res.data[0].id;
          //     const uploadedImage = res.data[0].url;
          //     const predictedImage = await predictImage(
          //       `http://18.143.172.4:1337${uploadedImage}`
          //     );

          //     console.log("Predicted", predictedImage);
          //     axios
          //       .post("http://18.143.172.4:1337/api/attendances", {
          //         data: {
          //           image: imageId,
          //           name: predictedImage.name,
          //           status: true,
          //         },
          //       })
          //       .then(() => {
          //         msg.reply("Media berhasil diunggah ke API");
          //         msg.reply("Berhasil melakukan absen");
          //       });
          //   })
          //   .catch((err) => {
          //     console.log("err?.response", err?.response);
          //     console.log("err?.response?.data", err?.response?.data);
          //     msg.reply("Terjadi kesalahan saat mengunggah media ke API");
          //   });
        })
        .catch((err) => {
          console.log(err.response.data);
        });

      // axios
      //   .post("http://18.143.172.4:1337/api/upload", formData)
      //   .then(async (res) => {
      //     const imageId = res.data[0].id;
      //     const uploadedImage = res.data[0].url;
      //     const predictedImage = await predictImage(
      //       `http://18.143.172.4:1337${uploadedImage}`
      //     );

      //     console.log("Predicted", predictedImage);
      //     axios
      //       .post("http://18.143.172.4:1337/api/attendances", {
      //         data: {
      //           image: imageId,
      //           name: predictedImage.name,
      //           status: true,
      //         },
      //       })
      //       .then(() => {
      //         msg.reply("Media berhasil diunggah ke API");
      //         msg.reply("Berhasil melakukan absen");
      //       });
      //   })
      //   .catch((err) => {
      //     console.log(err?.response);
      //     console.log(err);
      //     msg.reply("Terjadi kesalahan saat mengunggah media ke API");
      //   });
    }
  });

  async function getClasses() {
    const dataClasses = await axios.get("http://18.143.172.4:1337/api/users");

    return dataClasses;
  }

  // Function to get image classification prediction with TF.js
  async function predictImage(uploadedImage) {
    const classes = await getClasses();

    // Load image data into TensorFlow.js tensor
    const imageBuffer = await new Promise((resolve, reject) => {
      request(
        { url: uploadedImage, encoding: null },
        (error, response, body) => {
          if (error) reject(error);
          else if (response.statusCode !== 200)
            reject(
              new Error(
                `Failed to retrieve image, status code: ${response.statusCode}`
              )
            );
          else resolve(body);
        }
      );
    });

    // Load the image buffer into a canvas
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, 224, 224);
    const imageData = ctx.getImageData(0, 0, 224, 224);
    const { data } = imageData;
    const imageArray = new Float32Array(224 * 224 * 3);

    let pixelIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
      imageArray[pixelIndex++] = data[i] / 255;
      imageArray[pixelIndex++] = data[i + 1] / 255;
      imageArray[pixelIndex++] = data[i + 2] / 255;
    }
    console.log("imageArray", imageArray);

    const imageTensor = tf.tensor4d(imageArray, [1, 224, 224, 3], "float32");

    // Load TensorFlow.js model
    const model = await tf.loadLayersModel(
      "http://localhost:3001/tfjs_model/model.json"
    );

    console.log("Load model succesfully!");

    const output = model.predict(imageTensor);

    const predictedClass = output.argMax(1).dataSync()[0];

    console.log("OUTPUT", output.argMax(1));
    console.log("OUTPUT DATA SYNC", output.argMax(1).dataSync());
    console.log(predictedClass);
    console.log(classes.data);
    console.log("PREDICTED CLASS", classes.data[predictedClass]);

    return classes.data[predictedClass];
  }

  client.initialize();

  console.log("App listen in port: 3001");
});
