import streamlit as st
import tensorflow as tf
from tensorflow.keras.preprocessing import image
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import os

# -----------------------------
# FIREBASE CONNECTION
# -----------------------------
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json")  # your Firebase key file
    firebase_admin.initialize_app(cred)

db = firestore.client()

# -----------------------------
# LOAD MODEL
# -----------------------------
@st.cache_resource
def load_model():
    model = tf.keras.models.load_model("trash_classifier_model.h5")
    return model

model = load_model()
class_names = ['glass', 'metal', 'organic', 'plastic']

# -----------------------------
# STREAMLIT PAGE CONFIG
# -----------------------------
st.set_page_config(page_title="AI Trash Classifier", page_icon="♻️", layout="wide")
st.title("♻️ AI Trash Classifier")
st.write("Upload a photo of trash and the model will identify what type it is!")

uploaded_file = st.file_uploader("Upload an image", type=["jpg", "jpeg", "png"])

# -----------------------------
# IMAGE PREDICTION
# -----------------------------
if uploaded_file is not None:
    img = image.load_img(uploaded_file, target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, 0) / 255.0

    predictions = model.predict(img_array)
    score = tf.nn.softmax(predictions[0])
    result_class = class_names[np.argmax(score)]
    confidence = np.max(score) * 100

    st.image(img, caption=f"Prediction: {result_class} ({confidence:.2f}%)", use_column_width=True)
    st.success(f"This looks like **{result_class.upper()}** waste.")

    # Update Firebase stats
    doc_ref = db.collection("trash_stats").document(result_class)
    doc = doc_ref.get()
    if doc.exists:
        doc_ref.update({"count": doc.to_dict().get("count", 0) + 1})
    else:
        doc_ref.set({"count": 1})

# -----------------------------
# DISPLAY FIREBASE DATA
# -----------------------------
st.header("📊 Live Waste Statistics")
stats = db.collection("trash_stats").stream()
data = {doc.id: doc.to_dict()["count"] for doc in stats}
if data:
    df = pd.DataFrame(list(data.items()), columns=["Category", "Count"])
    total = df["Count"].sum()
    df["Percent"] = (df["Count"] / total) * 100
    st.bar_chart(df.set_index("Category")["Percent"])
    st.table(df)
else:
    st.write("No data yet — upload your first image!")
