// blazeface 模型的获取地址，这里要使用hs静态服务器工具
export const modelUrl = 'http://192.168.3.2:8080/model.json';
// 后端人脸识别服务接口地址
export const faceServerHost = 'http://192.168.199.134:5000/';
// 默认的摄像头为前置摄像头
export const devicePosition = 'front';
// 上弹框，开始状态是没有弹出
export const popupSetting = false;
// 光照强度阈值
export const dimThreshold = 80;
export const brightThreshold = 150;
//间隔多少帧检测一次人脸
export const detectFacePerFrame = 10;