# Waste Classification Model & Real-Time Dashboard

## Introduction

This project is a full-stack waste classification pipeline that takes images of trash and classifies them into **plastic**, **metal**, and **organic** categories. It combines a Python-based machine learning model with a web dashboard built in **HTML/CSS/JavaScript**, providing **real-time analytics** on waste composition, estimated weights, and environmental impact. All predictions and aggregated stats are streamed to the front end through a cloud-backed data layer for live, automated updates.

## Technical Implementation 🛠

- **Machine Learning Model (Python)**
  - Image classification model trained on labeled trash images to distinguish between plastic, metal, and organic waste.
  - Scripts in the `ai_app` directory handle dataset loading, preprocessing (resize/normalize), training, and running inference.
  - Model outputs are formatted as structured records (e.g., label, confidence scores, timestamp) ready to be pushed into the live data pipeline.

- **Data Pipeline & Automation**
  - After inference, predictions are written to a cloud backend, where they are aggregated into running totals, percentages, and environmental impact metrics.
  - The system is designed so that new predictions automatically propagate to the dashboard without manual refresh, enabling continuous “live conveyor belt” monitoring.

- **Web Dashboard (HTML/CSS/JavaScript)**
  - The main dashboard is implemented using `index.html`, `style.css`, and `script.js`, forming a single-page application.
  - Uses **Firebase** configuration (`firebase-config.js`) to connect to a hosted backend for authentication and real-time data access.
  - Employs charting utilities (e.g., bar/pie charts) to visualize category percentages, estimated weights, and trends over time.

- **Cloud Integration**
  - **Firebase** is used as the central data layer to store live classification results and expose them to the frontend via real-time listeners.
  - The dashboard subscribes to updates (e.g., a `live_conveyor_belt_stats` collection), ensuring all charts and counters stay synchronized with the latest model output.


## Dashboard Features 📊

- **Real-Time Waste Composition**
  - Live percentage breakdown of plastic, metal, glass and organic waste, updated as new items are classified.
  - Visual indicators and charts to quickly assess the current waste stream composition.

- **Estimated Weights & Counts**
  - Aggregated totals for each material type, including approximate weights and item counts.
  - Useful for estimating resource recovery potential or landfill diversion.

- **Environmental Impact Metrics**
  - Derived metrics (e.g., estimated CO₂ savings or diversion equivalents) based on classification results.
  - Designed to communicate the environmental benefit of proper sorting and recycling in a clear, visual way.

- **Responsive Web UI**
  - Frontend layout styled via `style.css` to remain usable on laptops and larger displays (e.g., kiosk screens).
  - Real-time animations and transitions make changes in the data visually obvious to users.
