import { parseMIDI } from "./Parser";

const input = document.getElementById("fileInput") as HTMLInputElement;

input.addEventListener("change", function(event) {
  const reader = new FileReader();

  if (input.files) {
    reader.readAsArrayBuffer(input.files[0]);

    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        const binaryData = new Uint8Array(reader.result);

        console.log(parseMIDI(binaryData));
      } else {
        throw new Error("FileReader result is not an ArrayBuffer");
      }
    };
  }
});
