# Image & Video Brightening with Zero-DCE

This repository consists of 3 parts:


1. A Deep Learning model training framework to perform low light image enhancement (Python, Tensorflow, Pillow, Numpy)
2. Simple software to read low light video file and save a brightened version of the same, with audio (C++, OpenCV, Tensorflow C++ API, FFMPEG)
3. A browser frontend for selecting and previewing local images and videos

## Frontend

The repository includes a browser workspace in `frontend/` and a local Flask API that runs the included Zero-DCE TFLite model with LiteRT. Selecting or dropping an image previews the original locally; pressing **Enhance** sends it to the local model and displays the returned result for comparison and download.

To run the complete image-enhancement app, use Python 3.10 or 3.11:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python backend/app.py
```

Open <http://localhost:5001>. The backend loads `Zero-DCE/model_trained/model.tflite` on the first health check. Keep the process running while using the app. Image inference is supported; video preview is available, but video enhancement still uses the separate C++ workflow below.

The Vercel deployment serves the static frontend only. To use model inference, run the local backend and open its `localhost:5001` page.

## Brightening Algorithm - Zero-DCE
The deep learning model is a Tensorflow 2.2 implementation of:

#### Zero-Reference Deep Curve Estimation for Low-Light Image Enhancement (CVPR 2020)

Paper: https://openaccess.thecvf.com/content_CVPR_2020/papers/Guo_Zero-Reference_Deep_Curve_Estimation_for_Low-Light_Image_Enhancement_CVPR_2020_paper.pdf

Authors: Chunle Guo, Chongyi Li et al.

License: Non commercial use only

### Requirements

- Python 3
- Tensorflow 2.2
- Pillow
- Numpy
- abseil

### Usage

Training:
```python
python train.py --data_path=< Path to data (jpg/png) >

```

Testing:
```python
python inference_save.py --data_path=< Path to data (jpg/png) > --model_path=./model_trained/ --image_savepath=< Image save path>

```

Note: This is a zero reference learning algorithm. It does not need input and target pairs.
	  The dataloader assumes all images in the path are therefore inputs to the model.

## Sample Results

Sample Input 1
![Alt text](./Zero-DCE/samples/jon_snow_inp.png?raw=true "Sample Input1")
Sample Output 1
![Alt text](./Zero-DCE/samples/jon_snow_out.png?raw=true "Sample Output1")
Sample Input 2
![Alt text](./Zero-DCE/samples/dragon_inp.jpg?raw=true "Sample Input2")
Sample Output 2
![Alt text](./Zero-DCE/samples/dragon_out.png?raw=true "Sample Output2")
Sample Input 3
![Alt text](./Zero-DCE/samples/man_inp.jpg?raw=true "Sample Input3")
Sample Output 3
![Alt text](./Zero-DCE/samples/man_out.png?raw=true "Sample Output3")

## Video Enhancement Software

Simple code to read input video file frame by frame, run the deep learning model on it and save the enhanced video file.

### Requirements

- C++11
- Tensorflow CC (https://github.com/FloopCZ/tensorflow_cc)
- OpenCV 4
- FFMPEG
- Linux based OS

### Usage

Compile:
```c++
mkdir build && cd build
cmake ..
make

```

Run:
```c++
cd ../bin
./video-enhancement <model path> <source video> <destination video>

```
Note: cmake needs to be modified for specific libprotobuf library.
