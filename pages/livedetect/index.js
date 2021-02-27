import * as blazeface from '../../model/index'
Page({
  data: {
    result: "载入中...",
    factor:0
  },
  _modelUrl: 'http://192.168.3.5:8080/model.json',
  _model: null,
  _ctx: null,
  _count: 0,
  async onReady(){
    this.loadmodel(this._modelUrl)
    const listener = this.addCameraLinstener()   
    listener.start();
    this.initCanvas()
  },
  async loadmodel(modelUrl){
    const model = await blazeface.load({maxFaces:1, modelUrl:modelUrl});
    this._model = model;
  },
  addCameraLinstener(){
    const camera = wx.createCameraContext();
    const listener = camera.onCameraFrame(async frame=> {
      this._count++;
      if (this._count === 10) {      
        const res = await this.detectFace(frame);

        // 计算偏离值和缩放比
        if(this.data.factor === 0){
          let offsetX=0, offsetY=0,factor=0
          if(frame.height>frame.width){
            factor = 288 / frame.width
            offsetY = (frame.height*factor-288)/2
          }
          else{
            factor = 288 / frame.height
            offsetX = (frame.width*factor-288)/2
          }
          this.setData({
            factor,
            offsetY,
            offsetX,
            imageWidth: frame.width,
            imageHeight:frame.height,
          })
        }

        this.clearMarkCanvas();
        this.drawFace(res);
        this.showDetectInfo(res);
        this._count = 0;
      }
    });
    return listener
  },
  initCanvas(){
    const query = wx.createSelectorQuery()
    query.select('#mark-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')

        const systemInfo = wx.getSystemInfoSync()
        const dpr = systemInfo.pixelRatio
        const screenWidth = systemInfo.screenWidth
        const screenHeight = systemInfo.screenHeight
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        const scaleFactor = screenWidth * dpr / 375
        this.setData({
          screenWidth,
          screenHeight,
          windowWidth: canvas.width,
          windowHeight:canvas.height,
          scaleFactor,
          dpr
        })
        ctx.scale(scaleFactor, scaleFactor)

        ctx.lineWidth = 3
        ctx.strokeStyle = 'red'
        ctx.fillStyle = 'yellow'
        
        this._ctx = ctx
      })
  },
  async detectFace(frame) {
    if (this._model) { 
      return await this._model.estimateFaces(new Uint8Array(frame.data),
      frame.width,frame.height);
    }
  },
  clearMarkCanvas(){
    this._ctx.clearRect(0,0,288,288)
  },
  drawFace(res){
    if(res.length>=1){
      // 画关键点
      const landmarks = res[0].landmarks
      for(let i=0;i<6;++i){
        const point = this.transformPoint([landmarks[i][0],landmarks[i][1]])
        this._ctx.fillRect(point[0],point[1],6,6)
      } 

      // 画预测框
      const start = this.transformPoint(res[0].topLeft)
      const end = this.transformPoint(res[0].bottomRight);
      const size = [end[0] - start[0], end[1] - start[1]];
      
      this._ctx.strokeRect(start[0], start[1], size[0], size[1]);
    }
  },
  transformPoint(point){
    const x = point[0] * this.data.factor - this.data.offsetX
    const y = point[1] * this.data.factor - this.data.offsetY
    return [x,y]
  },
  showDetectInfo(res){
    if(res.length>=1){
      this.setData({
        result:"检测到人脸"
      })
    }
    else{
      this.setData({
        result: "没有检测到人脸"
      })
    }
  },
  takePhoto(){
    const camera = wx.createCameraContext()
    camera.takePhoto({
      success(res){
        console.log(res.tempImagePath)
      }
    })
  },
  drawFrame(frame){
    wx.canvasPutImageData({
      canvasId: 'camera-canvas',
      data: new Uint8ClampedArray(frame.data),
      height: frame.height,
      width: frame.width,
      x: 0,
      y: 0,
    })
  }
})