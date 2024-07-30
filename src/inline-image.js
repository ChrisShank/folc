export function inlineImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = document.createElement('img');
      img.src = reader.result;
      resolve(img);
    };
    reader.readAsDataURL(file);
  });
}
