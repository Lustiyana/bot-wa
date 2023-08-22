const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const express = require("express");
const FormData = require("form-data");
const { Blob } = require("buffer");
require("dotenv/config");

const modelUrl = process.env.MODEL_URL;
const strapiURL = process.env.STRAPI_URL;

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

  const getPhoneNumber = (message) => {
    const phoneNumberWithSuffix = message.from;
    const phoneNumberWithoutSuffix = phoneNumberWithSuffix.replace("@c.us", "");
    const phoneNumber = phoneNumberWithoutSuffix.replace(/^62/, "");
    return phoneNumber;
  };

  // Handle incoming messages with media files
  client.on("message", async (msg) => {
    const phone = getPhoneNumber(msg);
    if (msg.body === "hai") {
      msg.reply("Hai ada yang bisa dibantu");
    }
    if (msg.hasMedia) {
      msg.reply("Tunggu sebentar ya, absen kamu sedang diproses");
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
      axios.get(`${strapiURL}/api/users?sort=name`).then((res) => {
        let dataIds = [];
        res.data.map((item) => {
          dataIds.push(item.id);
        });
        formData.append("classes", dataIds.join(";"));
        axios
          .post(`${modelUrl}/process`, formData)
          .then(async (res) => {
            if (res.data.success) {
              try {
                await axios
                  .get(`${strapiURL}/api/users/${res.data.prediction}`)
                  .then(async (res) => {
                    if (
                      phone === res.data.phone &&
                      res.data.phone != undefined
                    ) {
                      try {
                        await axios
                          .post(`${strapiURL}/api/attendances`, {
                            data: {
                              name: res.data.name,
                              nim: res.data.nim,
                              status: true,
                            },
                          })
                          .then((res) => {
                            msg.reply(
                              `Selamat! ${res.data.data.attributes.name} dengan nim ${res.data.data.attributes.nim} telah melakukan absen`
                            );
                          })
                          .catch((err) => {
                            console.log(err);
                          });
                      } catch (err) {
                        console.log(err);
                      }
                    } else {
                      msg.reply(
                        `Absen gagal! Nomor telepon yang digunakan tidak sesuai dengan nama ${res.data.name} dan nim ${res.data.nim}`
                      );
                    }
                  });
              } catch (err) {
                console.log(err);
              }
            } else {
              msg.reply(res.data.error);
            }
          })
          .catch((err) => {
            console.log(err);
          });
      });
    }
  });

  client.initialize();

  console.log("App listen in port: 3001");
});
