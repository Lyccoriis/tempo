const SIZE = 256;

export function readPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not a picture'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that picture'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that picture'));
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not read that picture'));
          return;
        }
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
