// src/services/offerService.js
import api from "../api/axios";

export const sendOffer = (data) => {
  return api.post("/v1/offers/send", data);
};

export const downloadOffer = (data) => {
  return api.post("/v1/offers/download", data, {
    responseType: "blob",
  });
};
