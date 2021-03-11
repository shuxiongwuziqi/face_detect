/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tfconv from '@tensorflow/tfjs-converter';
import * as tf from '@tensorflow/tfjs-core';
/*
 * The object describing a face.
 */
export interface NormalizedFace {
  /** The upper left-hand corner of the face. */
  topLeft: [number, number]|tf.Tensor1D;
  /** The lower right-hand corner of the face. */
  bottomRight: [number, number]|tf.Tensor1D;
  /** Facial landmark coordinates. */
  landmarks?: number[][]|tf.Tensor2D;
  /** Probability of the face detection. */
  probability?: number|tf.Tensor1D;
}

// Blazeface scatters anchor points throughout the input image and for each
// point predicts the probability that it lies within a face. `ANCHORS_CONFIG`
// is a fixed configuration that determines where the anchor points are
// scattered.
declare interface AnchorsConfig {
  strides: [number, number];
  anchors: [number, number];
}
const ANCHORS_CONFIG: AnchorsConfig = {
  'strides': [8, 16],
  'anchors': [2, 6]
};

// `NUM_LANDMARKS` is a fixed property of the model.
const NUM_LANDMARKS = 6;

function generateAnchors(
    width: number, height: number, outputSpec: AnchorsConfig): number[][] {
  const anchors = [];
  for (let i = 0; i < outputSpec.strides.length; i++) {
    const stride = outputSpec.strides[i];
    const gridRows = Math.floor((height + stride - 1) / stride);
    const gridCols = Math.floor((width + stride - 1) / stride);
    const anchorsNum = outputSpec.anchors[i];

    for (let gridY = 0; gridY < gridRows; gridY++) {
      const anchorY = stride * (gridY + 0.5);

      for (let gridX = 0; gridX < gridCols; gridX++) {
        const anchorX = stride * (gridX + 0.5);
        for (let n = 0; n < anchorsNum; n++) {
          anchors.push([anchorX, anchorY]);
        }
      }
    }
  }

  return anchors;
}

function decodeBounds(
    boxOutputs: tf.Tensor2D, anchors: tf.Tensor2D): tf.Tensor2D {
  const boxStarts = tf.slice(boxOutputs, [0, 1], [-1, 2]);
  const centers = tf.add(boxStarts, anchors);
  const boxSizes = tf.slice(boxOutputs, [0, 3], [-1, 2]);

  const halfBoxSize = tf.div(boxSizes, 2);
  const starts = tf.sub(centers, halfBoxSize);
  const ends = tf.add(centers, halfBoxSize);

  const concatAxis = 1;
  return tf.concat2d(
      [starts as tf.Tensor2D, ends as tf.Tensor2D],
      concatAxis);
}


type FrameData = {
  data: Uint8Array,
  width: number,
  height: number
}


export class BlazeFaceModel {
  private blazeFaceModel: tfconv.GraphModel;
  private width: number;
  private height: number;
  private maxFaces: number;
  private anchors: tf.Tensor2D;
  private anchorsData: number[][];
  private iouThreshold: number;
  private scoreThreshold: number;
  private offsetX: number;
  private offsetY: number;
  private scaleFactor: number;

  constructor(
      model: tfconv.GraphModel, width: number, height: number, maxFaces: number,
      iouThreshold: number, scoreThreshold: number) {
    this.blazeFaceModel = model;
    this.width = width;
    this.height = height;
    this.maxFaces = maxFaces;
    this.anchorsData = generateAnchors(
        width, height,
        ANCHORS_CONFIG as
            {strides: [number, number], anchors: [number, number]});
    this.anchors = tf.tensor2d(this.anchorsData);

    this.iouThreshold = iouThreshold;
    this.scoreThreshold = scoreThreshold;
    
    this.offsetX = 0
    this.offsetY = 0
    this.scaleFactor = 1
  }

  makeSquare(image: tf.Tensor3D){
    const start = [0,0,0]
    const size = [-1,-1,-1]
    const [height,width,_] = image.shape
    if(height>width){
      this.offsetY = start[0] = (height-width) / 2
      size[0] = width
      this.scaleFactor = width / this.width
    }
    else{
      this.offsetX = start[1] = (width-height) / 2
      size[1] = height
      this.scaleFactor = height / this.height
    }
    return tf.slice(image,start,size)
  }

  async preprocess(image:FrameData){
    return tf.tidy(()=>{
      // 把uint8数据变成tensor数据
      const tensor3dImage = tf.browser.fromPixels(image);
      // 截取图片中间正方形部分
      const squareImage = this.makeSquare(tensor3dImage)
      // 缩小图片到 128*128
      const resizedImage = tf.image.resizeBilinear(squareImage,
        [this.width, this.height]);
      // 图片添加一个纬度（batch_size），用于适应预测输入要求
      const tensor4dImage = tf.expandDims(resizedImage, 0)
      // 图片从[0,255]归一化到[-1,1]
      // int[0,255] -cast-> float[0,255] -div-> float[0,2] -sub-> float[-1,1]
      const normalizedImage = tf.sub(tf.div(tf.cast(tensor4dImage, 'float32'), 127.5), 1);
      return normalizedImage
    })
  }

  async postprocess(res: tf.Tensor3D,returnLandmark:boolean):Promise<NormalizedFace[]>{
    // 获取解码后的预测框和对应置信度
    const [outputs, boxes, scores] =tf.tidy(()=>{
      const prediction = tf.squeeze(res); 
      const decodedBounds = decodeBounds(prediction as tf.Tensor2D, this.anchors);
      const logits = tf.slice(prediction as tf.Tensor2D, [0, 0], [-1, 1]);
      const scores = tf.squeeze(tf.sigmoid(logits));
      return [prediction as tf.Tensor2D, decodedBounds, scores as tf.Tensor1D];
    })

    // 非极大值抑制。因为没有同步模式，所以只能放到tidy外面
    const indicesTensor = await tf.image.nonMaxSuppressionAsync(
      boxes, scores, this.maxFaces, this.iouThreshold, this.scoreThreshold);
    const indices = indicesTensor.arraySync()

    // 根据抑制结果，截取出有效的预测框、关键点和置信度
    const [topLefts, bottomRights, score, landmarks] = tf.tidy(()=>{
      const suppressBox: tf.Tensor2D= tf.gather(boxes,indicesTensor)
      const topLefts = tf.slice(suppressBox,[0,0],[-1,2])
      .mul(this.scaleFactor).add(tf.tensor1d([this.offsetX,this.offsetY]))
      const bottomRights = tf.slice(suppressBox,[0,2],[-1,2])
      .mul(this.scaleFactor).add(tf.tensor1d([this.offsetX,this.offsetY]))
      const suppressScore = tf.gather(scores,indicesTensor)
      if(returnLandmark){
        const suppressOutput = tf.gather(outputs, indicesTensor)
        const landmarks = tf.slice(suppressOutput,[0,5],[-1,-1])
        .reshape([-1,NUM_LANDMARKS,2])
        return [topLefts.arraySync(),bottomRights.arraySync(),suppressScore.arraySync(),landmarks.arraySync()]
      }
      return [topLefts.arraySync(),bottomRights.arraySync(),suppressScore.arraySync(),[]]
    })
    
    // 删除没用的张量 防止内存泄漏
    outputs.dispose()
    boxes.dispose()
    scores.dispose()

    // 做关键点解码，封装成NormalizedFace数组
    const normalizedFaces:NormalizedFace[] = []
    for(let i in indices){
      const normalizedFace:NormalizedFace = {
        topLeft: topLefts[i],
        bottomRight: bottomRights[i],
        probability: score[i]
      }
      if(returnLandmark){
        const normalizedLandmark = (landmarks[i]).map((landmark:[number,number])=>([
          (landmark[0]+this.anchorsData[indices[i]][0])*this.scaleFactor+this.offsetX,
          (landmark[1]+this.anchorsData[indices[i]][1])*this.scaleFactor+this.offsetY
        ]))
        normalizedFace.landmarks = normalizedLandmark
      }
      normalizedFaces.push(normalizedFace)
    }
    indicesTensor.dispose()
    return normalizedFaces
  }
  async estimateFaces(image: Uint8Array, width: number, height: number, returnLandmark:boolean=true): Promise<NormalizedFace[]>{
    const preprocessImage = await this.preprocess({data:image,width,height})
    const batchedPrediction = await this.blazeFaceModel.predict(preprocessImage);
    preprocessImage.dispose()
    const result = this.postprocess(batchedPrediction as tf.Tensor3D, returnLandmark)
    batchedPrediction.dispose()
    return result
  }
}