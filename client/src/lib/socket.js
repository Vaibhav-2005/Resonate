"use client";
import { io } from "socket.io-client";

// Next.js will inject your URL here automatically!
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

export const socket = io(SERVER_URL, {
    autoConnect: false, 
});