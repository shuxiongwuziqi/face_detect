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
      'WEAK_LIGHT': 'RED',
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
      'WEAK_LIGHT': '光照不足',
      'LOADING_MODEL': '模型载入',
    },
  },
  _ctx: null,
  _canvas_size: 250,
  _modelUrl: 'http://192.168.3.7:8080/model.json',
  _faceServerHost: 'http://10.242.116.254:5000/',
  _model: null,
  _frameWidth: 0,
  _frameHeight: 0,
  _listener: null,
  _count: 0,
  _preStatus: 'LOADING_MODEL',

 
  
  async onReady(){
    this.loadmodel(this._modelUrl)
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
        const status = this.checkDetect(res)
        if(this._preStatus != status){
          this._preStatus = status
          this.setData({status})
        }

        if(status === 'DETECT_SUCCESS'){
          wx.showLoading({
            title: '等待上传',
            mask: true
          })
          this._listener.stop()
          this.lockFace()
          this.faceReconition(frame, res)
        }
        this._count = 0;
      }
    });
    return listener
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
  faceReconition(frame, res){
    const faceInfo = res[0]
    const start = faceInfo.topLeft.map(v=>Math.round(v))
    const end = faceInfo.bottomRight.map(v=>Math.round(v))
    const size = [end[0]-start[0], end[1]-start[1]]

    const imageTensor = tf.browser.fromPixels({
      data:new Uint8Array(frame.data),
      width:frame.width,
      height:frame.height
    })
    const image = tf.tidy(()=>{
      const croppedImage = tf.slice(imageTensor,
        [start[1],start[0],0],
        [size[1],size[0],3])
      const flattedImage = croppedImage.reshape([-1])
      return flattedImage.arraySync()
    })
    const base64Image = wx.arrayBufferToBase64(image)
    console.log(size)
    console.log(base64Image)
    wx.request({
      url: this._faceServerHost+'search',
      data: {
        image: base64Image,
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
          wx.hideLoading()
        }
      },
      fail: e=>{
        console.log(e)
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
    this._listener.start()
    this.setData({
      status: 'DETECT_NOT_FOUND'
    })
  },
  checkDetect(res){
    const len = res.length
    if(len === 0){
      return 'DETECT_NOT_FOUND'
    }
    else if(len > 1){
      return 'DETECT_MULTI_FACES'
    }
    else{
      const faceInfo = res[0]
      const start = faceInfo.topLeft
      const end = faceInfo.bottomRight
      const size = [end[0] - start[0], end[1] - start[1]];
      if(size[0] < 0.5*this._frameWidth){
        return 'TOO_FAR'
      }
      else if(size[0] > 0.8*this._frameWidth){
        return 'TOO_CLOSE'
      }
      const mid = [start[0]+size[0]/2,start[1]+size[1]/2]
      if(mid[0]<this._frameWidth*0.4||mid[0]>this._frameWidth*0.6){
        return 'NOT_CENTER'
      }
      if(mid[1]<this._frameHeight*0.4||mid[1]>this._frameHeight*0.6){
        return 'NOT_CENTER'
      }
      return 'DETECT_SUCCESS'
    }
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
      return await this._model.estimateFaces(new Uint8Array(frame.data),
      frame.width,frame.height);
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