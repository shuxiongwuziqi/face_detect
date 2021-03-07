// pages/ui/index.js
import * as blazeface from '../../model/index'
Page({
  data:{
    backgroundColor: '',
    result: '请稍等...',
    devicePosition: 'front'
  },
  _ctx: null,
  _canvas_size: 250,
  _modelUrl: 'http://192.168.3.7:8080/model.json',
  _model: null,
  _frameWidth: 0,
  _frameHeight: 0,
  _listener: null,
  _count: 0,
  _preStatus: -1,

  colorMap:{
    'red': '#d93a49',
    'yellow': '#ffd400',
    'green': '#1d953f'
  },
  statusMap:{
    '1': '检测成功',
    '2': '未检测到人脸',
    '3': '有多张人脸',
    '4': '请靠近点',
    '5': '请离远点',
    '6': '人脸偏离',
    '7': '图片模糊',
    '8': '光照不足'
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
        if(this._frameWidth === 0){
          this._frameWidth = frame.width
          this._frameHeight = frame.height
        }
        const status = this.checkDetect(res)
        if(this._preStatus != status){
          this._preStatus = status
          this.turnStatus(status)
        }
        this._count = 0;
      }
    });
    return listener
  },
  checkDetect(res){
    const len = res.length
    if(len === 0){
      return 2
    }
    else if(len > 1){
      return 3
    }
    else{
      const faceInfo = res[0]
      const start = faceInfo.topLeft
      const end = faceInfo.bottomRight
      const size = [end[0] - start[0], end[1] - start[1]];
      if(size[0] < 0.5*this._frameWidth){
        return 4
      }
      else if(size[0] > 0.8*this._frameWidth){
        return 5
      }
      const mid = [start[0]+size[0]/2,start[1]+size[1]/2]
      if(mid[0]<this._frameWidth*0.4||mid[0]>this._frameWidth*0.6){
        return 6
      }
      if(mid[1]<this._frameHeight*0.4||mid[1]>this._frameHeight*0.6){
        return 6
      }
      return 1
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

        this.turnWindowColor('yellow')
      })
  },
  async detectFace(frame) {
    if (this._model) { 
      return await this._model.estimateFaces(new Uint8Array(frame.data),
      frame.width,frame.height);
    }
  },
  turnStatus(status){
    this.showStatus(status);
    let color = 'yellow'
    if(status === 1){
      color = 'green'
    }
    else if(status>0){
      color = 'red'
    }
    this.turnWindowColor(color)
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
  showStatus(status){
    const statusStr = this.statusMap[status.toString()]
    this.setData({
      result:statusStr
    })
  },
  onUnload(){
    console.log("stop camera listener")
    this._listener.stop()
  }
})