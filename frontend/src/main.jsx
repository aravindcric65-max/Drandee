import React from "react";
import ReactDom from "react-dom/client";
import App from "./App";
import "./styles/theme.css"
import { BrowserRouter } from "react-router-dom";
import { UserProvider } from "./context/UserContext";

ReactDom.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App/>
  </BrowserRouter>
);