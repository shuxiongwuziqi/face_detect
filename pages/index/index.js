// pages/ui/index.js
import * as blazeface from '../../model/index'
import * as tf from '@tensorflow/tfjs-core'
Page({
  data:{
    backgroundColor: '',
    devicePosition: 'back',
    flash: "off",
    status: 'LOADING_MODEL',
    popupSetting: false,
    faceServerHost: 'http://192.168.8.114:5000/',
    colorMap: {
      'WHITE': '#FFFFCC',
      'GREEN': '#1d953f',
      'RED': '#d93a49',
      'YELLOW': '#ffd400'
    },
    statusColor: {
      'RECOGNITION_SUCESS': 'WHITE',
      'DETECT_SUCCESS': 'GREEN',
      'DETECT_NOT_FOUND': 'RED',
      'DETECT_MULTI_FACES': 'RED',
      'TOO_FAR': 'RED',
      'TOO_CLOSE': 'RED',
      'NOT_CENTER': 'RED',
      'BLUR': 'RED',
      'TOO_BRIGHT': 'RED',
      'TOO_DIM': 'RED',
      'NOT_FRONT_FACE': 'RED',
      'LOADING_MODEL': 'YELLOW',
    },
    statusDisc: {
      'RECOGNITION_SUCESS': '识别成功',
      'DETECT_SUCCESS': '检测成功',
      'DETECT_NOT_FOUND': '未检测到人脸',
      'DETECT_MULTI_FACES': '有多张人脸',
      'TOO_FAR': '请靠近点',
      'TOO_CLOSE': '请离远点',
      'NOT_CENTER': '人脸偏离',
      'BLUR': '图片模糊',
      'TOO_DIM': '光照不足',
      'TOO_BRIGHT': '曝光',
      'LOADING_MODEL': '模型载入',
      'NOT_FRONT_FACE': '正脸面向摄像头'
    },
    threshold: {
      'dim': 80,
      'bright': 150,
      'distance': 3,
      'eyeNoseArea': 0.05
    },
    distance: 10,
    brightMean:0,
    faceImage: null,
    faceSize: 0
  },
  _model: null,
  _frameWidth: 0,
  _frameHeight: 0,
  _listener: null,
  _count: 0,
  _preStatus: 'LOADING_MODEL',
  _preLandmark: null,

 
  changeFaceServerHost(event){
    console.log(event.detail.value)
    this.setData({
      faceServerHost: event.detail.value
    })
  },
  async onReady(){
    this.loadmodel(this.data.faceServerHost+'static/blaze_face_model/model.json')
    this._listener = this.addCameraLinstener()   
    this._listener.start();
  },
  async loadmodel(modelUrl){
    const model = await blazeface.load({maxFaces:3, modelUrl:modelUrl});
    this._model = model;
  },
  addCameraLinstener(){
    const camera = wx.createCameraContext();
    const listener = camera.onCameraFrame(async frame=> {
      this._count++;
      if (this._count === 10) {    
        const res = await this.detectFace(frame);
        // 计算偏离值和缩放比
        if(this._frameWidth === 0){
          this._frameWidth = frame.width
          this._frameHeight = frame.height
        }
        const status = this.checkFace(frame, res)
        if(this._preStatus != status){
          this._preStatus = status
          this.setData({status})
        }

        if(status === 'DETECT_SUCCESS'){
          this._listener.stop()
          wx.showLoading({
            title: '等待上传',
            mask: true
          })
          this.lockFace()
          this.faceReconition()
        }

        // reset count
        this._count = 0;
      }
    });
    return listener
  },
  openSetting(){
    this._listener.stop()
    this.setData({
      popupSetting: true
    })
  },
  closeSetting(){
    this._listener.start()
    this.setData({
      popupSetting: false
    })
  },
  lockFace(){
    const ctx = wx.createCameraContext()
    ctx.takePhoto({
      quality: 'low',
      success: res=>{
        console.log(res.tempImagePath)
        this.setData({
          faceImage: res.tempImagePath
        })
      }
    })
  },
  faceReconition(){
    const base64Image = wx.arrayBufferToBase64(this.data.faceImage)
    const size = this.data.faceSize
    wx.request({
      url: this.data.faceServerHost+'search',
      data: {
        imageBase64: base64Image,
        width: size[0],
        height: size[1],
        channel: 3
      },
      method: 'POST',
      success: res=>{
        console.log(res)
        if(res.statusCode === 200){
          this.setData({
            status:'RECOGNITION_SUCESS'
          })
          this.showStudentInfo(res)
          wx.showToast({
            title: '识别成功',
            icon: 'success'
          })
        }
        else{
          wx.showToast({
            title: '返回错误',
            icon: 'error'
          })
          this.setData({
            status:'DETECT_NOT_FOUND'
          })
          this._listener.start()
        }
      },
      fail: e=>{
        console.log(e)
        wx.showToast({
          title: '上传失败',
          icon: 'error'
        })
        this.setData({
          status:'DETECT_NOT_FOUND'
        })
        this._listener.start()
      },
      complete:()=>{
        wx.hideLoading()
      }
    })
  },
  showStudentInfo(res){
    const info = res['data']
    console.log(info)
    this.setData({stuInfo: info})
  },
  onConfirm(){
    //request to confirm
    // wx.request({
    //   url: this.data.faceServerHost+'api/v1.0/sign_in',
    //   data:{
    //     'sid': 1,
    //     'sign_in_info': true
    //   },
    //   method: 'POST'
    // })
    this._listener.start()
    this.setData({
      status: 'DETECT_NOT_FOUND'
    })
  },
  changeFlash(){
    const flash = this.data.flash
    if(flash === 'off')
      this.setData({flash: 'torch'})
    else
      this.setData({flash: 'off'})
  },
  checkFace(frame, res){
    const len = res.length
    if(len === 0)
      return 'DETECT_NOT_FOUND'
    if(len > 1)
      return 'DETECT_MULTI_FACES'
    const faceInfo = res[0]
    let start = faceInfo.topLeft.map(v=>Math.round(v))
    const end = faceInfo.bottomRight.map(v=>Math.round(v))
    let size = [end[0]-start[0], end[1]-start[1]]
    // 为预测框 加padding
    // start = start.map(v=>Math.round(v-size[0]*0.2))
    // size = size.map(v=>Math.round(v*1.4))
    start[1] = Math.round(start[1] - size[0]*0.2)
    size[1] = Math.round(size[1]*1.2)

    if(size[0] < 0.5 * this._frameWidth)
      return 'TOO_FAR'
    if(size[0] > 0.8*this._frameWidth)
      return 'TOO_CLOSE'
    if(start[0]<0||end[0]>this._frameWidth)
      return 'NOT_CENTER'
    // camera在frame的数据上做了缩放居中
    // 所以在检测高度上的居中需要这样算
    const temp = (this._frameHeight-this._frameWidth)/2
    if(start[1]-temp<0||end[1]-temp>this._frameWidth)
    return 'NOT_CENTER'
    
    const landmarks = faceInfo.landmarks
    let distance = 100
    if(this._preLandmark != null){
      distance = tf.tidy(()=>{
        const pre =  tf.tensor(this._preLandmark)
        const cur = tf.tensor(landmarks)
        const dis = pre.sub(cur).norm('euclidean',1).mean()
        return dis.arraySync()
      })
      this.setData({distance})
    }
    this._preLandmark = landmarks
    if(distance > this.data.threshold['distance'])
      return 'BLUR'

    // const [a, b] = landmarks[0]
    // const [c,d] = landmarks[1]
    // const [e, f] = landmarks[2]

    // 计算双眼和鼻子之间围成的面积
    // let eyeNoseArea = Math.abs(a*d+b*e+c*f-a*f-b*c-d*e)/2

    // 双眼和嘴之间围成的面积三角形面积 除以 人脸预测框的面积
    // eyeNoseArea = eyeNoseArea / size[0] / size[1]
    // this.setData({eyeNoseArea})
    // if(eyeNoseArea < this.data.threshold['eyeNoseArea'])
    //   return 'NOT_FRONT_FACE'

    const [faceImage, brightMean] = tf.tidy(()=>{
      const imageTensor = tf.browser.fromPixels({
        data:new Uint8Array(frame.data),
        width:frame.width,
        height:frame.height
      })
      const croppedImage = tf.slice(imageTensor,
        [start[1],start[0],0],
        [size[1],size[0],3])
        .expandDims(0)
        const flattedImage = croppedImage.reshape([-1])
        const brightMean = tf.mean(flattedImage)
      return [flattedImage.arraySync(),brightMean.arraySync()]
    })
    // console.log(tf.memory())
    this.setData({brightMean,faceImage,faceSize:size})
    if(brightMean>this.data.threshold['bright'])
      return 'TOO_BRIGHT'
    if(brightMean<this.data.threshold['dim'])
      return 'TOO_DIM'
    // if(blurRate<this.data.blurThreshold)
    //   return 'BLUR'    
    return 'DETECT_SUCCESS'    
  },
  sliderValueChange(event){
    console.log(event)
    const thresholdName = event.currentTarget.dataset.thresholdName
    console.log(thresholdName)
    const threshold = this.data.threshold
    threshold[thresholdName] = event.detail.value
    this.setData({threshold})
  },
  async detectFace(frame) {
    if (this._model) { 
      const res = await this._model.estimateFaces(new Uint8Array(frame.data),
      frame.width,frame.height);
      return res
    }
  },
  turnWindowColor(colorName){
    this.setData({
      backgroundColor: this.colorMap[colorName]
    })
  }
})