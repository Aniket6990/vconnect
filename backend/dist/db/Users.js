"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    userid: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
    },
});
exports.users = mongoose_1.default.model("users", userSchema);
