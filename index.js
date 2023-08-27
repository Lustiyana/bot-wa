const qrcode = require("qrcode-terminal");
const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const { Blob } = require("buffer");
const { Client, LocalAuth } = require("whatsapp-web.js");
require("dotenv/config");

const modelUrl = process.env.MODEL_URL;
const strapiURL = process.env.STRAPI_URL;

const app = express();
app.use(express.static("public"));
app.listen(3001, () => {
  console.log("App listening on port 3001");

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "auth" }),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("WhatsApp bot ready");
  });

  function base64ToBlob(base64String, mimeType) {
    const byteCharacters = Buffer.from(base64String, "base64");
    const blob = new Blob([byteCharacters], { type: mimeType });
    return blob;
  }

  function getPhoneNumber(message) {
    return message.from.replace("@c.us", "").replace(/^62/, "");
  }

  client.on("message", async (msg) => {
    const phone = getPhoneNumber(msg);

    if (msg.body === "hai") {
      msg.reply("Hai ada yang bisa dibantu");
    }

    if (msg.hasMedia) {
      msg.reply("Tunggu sebentar ya, absen kamu sedang diproses");

      try {
        const media = await msg.downloadMedia();
        const formData = new FormData();
        const blob = base64ToBlob(media.data, media.mimetype);
        const buffer = Buffer.from(media.data, "base64");
        const dataURL = `data:${media.mimetype};base64,${buffer.toString(
          "base64"
        )}`;
        const ext = media.mimetype.split("/")[1];

        formData.append("image", Buffer.from(media.data, "base64"), {
          filename: `${Date.now()}.${ext}`,
          contentType: media.mimetype,
          knownLength: media.size,
        });

        const res = await axios.get(`${strapiURL}/api/users?sort=name`);
        const dataIds = res.data.map((item) => item.id);
        formData.append("classes", dataIds.join(";"));

        const mlResponse = await axios.post(`${modelUrl}/process`, formData);
        if (mlResponse.data.success) {
          const userResponse = await axios.get(
            `${strapiURL}/api/users/${mlResponse.data.prediction}`
          );
          const userData = userResponse.data;

          const populateImage = await axios.get(
            `${strapiURL}/api/attendances?filters[user][id][$eq]=${mlResponse.data.prediction}&populate=*`
          );
          const imagesAttendance = populateImage.data.data;
          const arr = [];
          for (const key in imagesAttendance) {
            arr.push(
              `${strapiURL}${imagesAttendance[key].attributes.image.data.attributes.url}`
            );
          }

          const formImageChecking = new FormData();
          formImageChecking.append("image", Buffer.from(media.data, "base64"), {
            filename: `${Date.now()}.${ext}`,
            contentType: media.mimetype,
            knownLength: media.size,
          });
          if (arr.length > 0) {
            formImageChecking.append("image_array", arr.join(";"));
          } else {
            formImageChecking.append("image_array", "");
          }
          const imageChecking = await axios.post(
            `${modelUrl}/image-checking`,
            formImageChecking
          );

          if (imageChecking.data.success) {
            if (phone === userData.phone && userData.phone !== undefined) {
              const formUpload = new FormData();
              formUpload.append("files", Buffer.from(media.data, "base64"), {
                filename: `${Date.now()}.${ext}`,
                contentType: media.mimetype,
                knownLength: media.size,
              });
              try {
                const uploadResponse = await axios.post(
                  `${strapiURL}/api/upload`,
                  formUpload
                  // { headers: { "Content-Type": "multipart/form-data" } }
                );
                await axios.post(`${strapiURL}/api/attendances`, {
                  data: {
                    name: userData.name,
                    nim: userData.nim,
                    status: true,
                    image: uploadResponse.data[0].id,
                    user: mlResponse.data.prediction,
                  },
                });
                msg.reply(
                  `Selamat! ${userData.name} dengan nim ${userData.nim} telah melakukan absen`
                );
              } catch (e) {
                console.log(e.response?.data?.error?.message);
                msg.reply(
                  `Terjadi kesalahan pada sistem, coba lagi.${e.response?.data?.error?.message}`
                );
              }
            } else {
              msg.reply(
                `Absen gagal! Nomor telepon yang digunakan tidak sesuai dengan nama ${userData.name} dan nim ${userData.nim}`
              );
            }
          } else {
            msg.reply(imageChecking.data.message);
          }
        } else {
          msg.reply(mlResponse.data.error);
        }
      } catch (error) {
        console.error(error);
        msg.reply("Terjadi kesalahan dalam memproses absen, coba lagi");
        throw error;
      }
    }
  });

  client.initialize();
});
