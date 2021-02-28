import * as blazeface from '../../model/index'
Page({
  data: {
    result: "载入中...",
    devicePosition: "back"
  },
  _modelUrl: 'http://127.0.0.1:8080/model.json',
  _model: null,
  _ctx: null,
  _count: 0,
  _offsetX: 0,
  _offsetY: 0,
  _factor: 0,
  _canvasWidth: 288,
  _canvasHeight: 352,
  _listener: null,

  onTurnCamera(){
    let devicePosition = ''
    if(this.data.devicePosition === 'front'){
      devicePosition = 'back'
    }
    else{
      devicePosition = 'front'
    }
    wx.redirectTo({
      url: `/pages/livedetect/index?devicePosition=${devicePosition}`,
    })
  },
  onLoad(options){
    if(typeof(options.devicePosition) != "undefined"){
      this.setData({
        devicePosition: options.devicePosition
      })
    }
  },
  async onReady(){
    this.loadmodel(this._modelUrl)
    this._listener = this.addCameraLinstener()   
    this._listener.start();
    this.initCanvas()
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
        if(this._factor === 0){
          if(frame.height > frame.width){
            this._factor = this._canvasWidth / frame.width
            this._offsetY = (frame.height * this._factor - this._canvasHeight) / 2
          }
          else{
            this._factor = this._canvasHeight / frame.height
            this._offsetX = (frame.width * this._factor - this._canvasWidth) / 2
          }
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
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        const scaleFactor = screenWidth * dpr / 375
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
    this._ctx.clearRect(0,0,this._canvasWidth,this._canvasHeight)
  },
  drawFace(res){
    res.map(face=>{
      // 画关键点
      const landmarks = face.landmarks
      for(let i=0; i<6; ++i){
        const point = this.transformPoint([landmarks[i][0],landmarks[i][1]])
        this._ctx.fillRect(point[0],point[1],6,6)
      }

      // 画预测框
      const start = this.transformPoint(face.topLeft)
      const end = this.transformPoint(face.bottomRight);
      const size = [end[0] - start[0], end[1] - start[1]];
      
      this._ctx.strokeRect(start[0], start[1], size[0], size[1]);
    })
  },
  transformPoint(point){
    const x = point[0] * this._factor - this._offsetX
    const y = point[1] * this._factor - this._offsetY
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
  onUnload(){
    console.log("stop camera listener")
    this._listener.stop()
  }
})