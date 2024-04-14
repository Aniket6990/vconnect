import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userid: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
});

export const users = mongoose.model("users", userSchema);
