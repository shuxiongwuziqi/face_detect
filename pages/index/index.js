// pages/ui/index.js
import * as blazeface from '../../model/index'
import * as tf from '@tensorflow/tfjs-core'
Page({
  data:{
    backgroundColor: '',
    result: '模型载入中',
    devicePosition: 'front',
    faceImage: '',
    status: 'LOADING_MODEL',
    popupSetting: false,
    modelUrl: 'http://127.0.0.1:8080/model.json',
    faceServerHost: 'http://192.168.199.134:5000/',
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
    },
    laplacianFilter: [
      [[[1],[1],[1]],[[1],[1],[1]],[[1],[1],[1]]],
      [[[1],[1],[1]],[[-8],[-8],[-8]],[[1],[1],[1]]],
      [[[1],[1],[1]],[[1],[1],[1]],[[1],[1],[1]]],
    ],
    dimThreshold: 80,
    brightThreshold: 150,
    blurThreshold: 500,
    brightMean:0,
    blurRate: 0,
    faceImage: null,
    faceSize: 0
  },
  _ctx: null,
  _canvas_size: 250,
  _model: null,
  _frameWidth: 0,
  _frameHeight: 0,
  _listener: null,
  _count: 0,
  _preStatus: 'LOADING_MODEL',

 
  changeModelUrl(event){
    console.log(event.detail.value)
    this.setData({
      modelUrl: event.detail.value
    })
  },
  changeFaceServerHost(event){
    console.log(event.detail.value)
    this.setData({
      faceServerHost: event.detail.value
    })
  },
  async onReady(){
    this.loadmodel(this.data.modelUrl)
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
  popupSetting(){
    this.setData({
      popupSetting: true
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
      url: this.data.faceServerHost+'api/v1.0/face_recognize',
      data: {
        imageBase64: base64Image,
        width: size[0],
        height: size[1],
        channel: 3,
        blurThreshold: this.data.blurThreshold
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
        else if(res.statusCode === 201){
          this.setData({
            status:'BLUR'
          })
          this._listener.start()
        }
        this.setData({
          blurRate: res.data.blurRate
        })
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
    wx.request({
      url: this.data.faceServerHost+'api/v1.0/sign_in',
      data:{
        'sid': 1,
        'sign_in_info': true
      }
    })
    this._listener.start()
    this.setData({
      status: 'DETECT_NOT_FOUND'
    })
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
    if(brightMean>this.data.brightThreshold)
      return 'TOO_BRIGHT'
    if(brightMean<this.data.dimThreshold)
      return 'TOO_DIM'
    // if(blurRate<this.data.blurThreshold)
    //   return 'BLUR'    
    return 'DETECT_SUCCESS'
    
  },
  sliderDimValueChange(event){
    this.setData({
      dimThreshold: event.detail.value
    }) 
  },
  sliderBrightValueChange(event){
    this.setData({
      brightThreshold: event.detail.value
    })
  },
  sliderBlurValueChange(event){
    this.setData({
      blurThreshold: event.detail.value
    })
  },
  initCanvas(){
    const query = wx.createSelectorQuery()
    query.select('#canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        const systemInfo = wx.getSystemInfoSync()
        const dpr = systemInfo.pixelRatio
        const screenWidth = systemInfo.screenWidth
        
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        
        const scaleFactor = screenWidth * dpr / 375
        ctx.scale(scaleFactor, scaleFactor)

        this._ctx = ctx
      })
  },
  async detectFace(frame) {
    if (this._model) { 
      const res = await this._model.estimateFaces(new Uint8Array(frame.data),
      frame.width,frame.height);
      return res
    }
  },
  turnWindowColor(colorName){
    const backgroundColor = this.colorMap[colorName]
    this.setData({
      backgroundColor
    })
    // wx.setNavigationBarColor({
    //   frontColor: '#ffffff',
    //   backgroundColor,
    //   animation: {
    //     duration: 50,
    //     timingFunc: 'linear'
    //   }
    // })
    // this.drawMask(backgroundColor)
  },
  drawMask(color){
    // set fill color 
    const ctx = this._ctx
    ctx.fillStyle = color

    const xy = [
      [0.5,1,0.5,0,0.5],
      [1,1,0,0,1]
    ];
    const size = this._canvas_size
    const angle = Math.PI / 2

    for(let i=0;i<4;++i){
      ctx.beginPath();
      ctx.moveTo(xy[0][i+1]*size, xy[0][i]*size);
      ctx.arc(size/2, size/2, size/2, angle*i, angle*(i+1));
      ctx.lineTo(xy[1][i+1]*size, xy[1][i]*size);
      ctx.closePath();
      ctx.fill();
    }
  },
  onUnload(){
    console.log("stop camera listener")
    this._listener.stop()
  }
})