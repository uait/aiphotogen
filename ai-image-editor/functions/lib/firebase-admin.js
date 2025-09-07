"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseAuth = getFirebaseAuth;
exports.getFirestore = getFirestore;
exports.verifyAuthToken = verifyAuthToken;
// Firebase Admin SDK initialization for Cloud Functions
const admin = __importStar(require("firebase-admin"));
// Firebase Admin is already initialized in Cloud Functions
// We just need to ensure we can access the services
function getFirebaseAuth() {
    return admin.auth();
}
function getFirestore() {
    return admin.firestore();
}
async function verifyAuthToken(authHeader) {
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
        return null;
    }
    try {
        const token = authHeader.substring(7);
        const auth = getFirebaseAuth();
        const decodedToken = await auth.verifyIdToken(token);
        return decodedToken.uid;
    }
    catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
}
//# sourceMappingURL=firebase-admin.js.map