import html2canvas from "html2canvas";

export const exportCard = async (elementId) => {
    const element = document.getElementById(elementId);

    const canvas = await html2canvas(element);
    const image = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = image;
    link.download = "portfolio.png";
    link.click();
};