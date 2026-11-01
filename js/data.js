/* All numbers below are copied from content.md. Do not edit without checking the source. */
const DATA = {
  meta: {
    title: "การประเมินราคารถยนต์มือสอง โดยการเรียนรู้ของเครื่องแบบมีผู้สอน",
    advisor: "รองศาสตราจารย์ ดร.ธิดาพร ศุภภากร",
    date: "2 พฤศจิกายน 2569"
  },

  members: [
    { id: "6610400750", name: "นายภูตะวัน นิลสนธิ" },
    { id: "6610400776", name: "นางสาวยุพารัตน์ แก้วเพชร" },
    { id: "6610400792", name: "นางสาววรัญญา สุวรรณสุทธิ์" },
    { id: "6610400814", name: "นางสาวอนาตี นิยมเดชา" },
    { id: "6610401195", name: "นางสาวฉัตรพร โพธิ์ทรัพย์" }
  ],

  priceIndex: {
    labels: ["พ.ค. 2563", "พ.ค. 2564", "พ.ค. 2565", "พ.ค. 2566", "พ.ค. 2567", "พ.ค. 2568"],
    values: [98.11, 104.76, 85.32, 62.88, 67.49, 70.41],
    baseYear: "2558",
    source: "ดัชนีราคารถยนต์มือสอง ธนาคารแห่งประเทศไทย (2569)"
  },

  related: [
    {
      short: "การพยากรณ์ราคารถยนต์มือสองด้วยเทคนิคการสกัดข้อมูลจากเว็บไซต์",
      title: "การพยากรณ์ราคารถยนต์มือสองโดยใช้เทคนิคการสกัดข้อมูลจากเว็บไซต์และแบบจำลองการเรียนรู้ของเครื่อง",
      author: "ภูริทรัพย์ และคณะ",
      year: "2569",
      best: "XGBoost",
      bestKind: "xgb",
      result: "ความแม่นยำ 92.38%, MAPE 7.62% — เชื้อเพลิง ประเภทรถ ขนาดเครื่องยนต์ และยี่ห้อ มีอิทธิพลสูงสุด",
      variables: "ยี่ห้อ, รุ่น, ประเภทรถ, สี, เชื้อเพลิง, ขนาดเครื่องยนต์, ระบบเกียร์, ระยะทางที่วิ่งทั้งหมด, จังหวัด, รุ่นย่อย, ระบบขับเคลื่อน, ปีที่ผลิต, สร้างคุณลักษณะใหม่ 6 ตัวแปร",
      methods: "XGBoost, Random Forest, LightGBM, CatBoost, Gradient Boosting"
    },
    {
      short: "Automobile Price Prediction using Regression Models",
      title: "Automobile Price Prediction using Regression Models",
      author: "Rupesh Gupta et al.",
      year: "2022",
      best: "Random Forest",
      bestKind: "rf",
      result: "R² 0.93, MAE 1390.0, RMSE 2139.7",
      variables: "25 ตัวแปร เช่น ประเภทเชื้อเพลิง, ยี่ห้อ, ระบบอัดอากาศ, ระดับความเสี่ยงด้านประกันภัย, จำนวนกระบอกสูบ, ตำแหน่งเครื่องยนต์",
      methods: "Linear Regression, Random Forest, Decision Tree, Elastic Net, SVR"
    },
    {
      short: "Analysis of Factors influencing Used Car prices",
      title: "Analysis of Factors influencing Used Car prices based on Regression Model",
      author: "Chamupaty et al.",
      year: "2025",
      best: "MLR (วิเคราะห์ปัจจัย)",
      bestKind: "mlr",
      result: "แบรนด์ อายุของรถ และระยะทางที่ขับขี่ มีสำคัญต่อราคา ขณะที่ประเภทของผู้ขายมีผลกระทบน้อยที่สุด",
      variables: "อายุของรถ, ระยะทางที่ขับขี่, ประเภทของแบรนด์, ประเภทของผู้ขาย",
      methods: "Multiple Linear Regression (MLR)"
    },
    {
      short: "Prediction Of Used Car Prices Using ANN And ML",
      title: "Prediction Of Used Car Prices Using Artificial Neural Networks And Machine Learning",
      author: "Varshitha et al.",
      year: "2022",
      best: "Random Forest",
      bestKind: "rf",
      result: "MAE 0.746, R² 0.917",
      variables: "บริษัทผู้ผลิต, ปีที่ซื้อรถยนต์, ราคา ณ วันที่ซื้อรถยนต์, ระยะทางรวม, ประเภทเชื้อเพลิง, ประเภทคนขาย, ระบบเกียร์, จำนวนเจ้าของ",
      methods: "Deep Neural Network, Linear Regression, Lasso Regression, Ridge Regression, Random Forest"
    },
    {
      short: "Price Prediction of Used Cars Using Machine Learning",
      title: "Price Prediction of Used Cars Using Machine Learning",
      author: "Jin",
      year: "2026",
      best: "Random Forest",
      bestKind: "rf",
      result: "R² 0.90416",
      variables: "ระยะทางที่วิ่ง, ปีที่ผลิต, อัตราการสิ้นเปลืองน้ำมัน, ระบบเกียร์, ภาษีรถประจำปี, ประเภทเชื้อเพลิง, ขนาดเครื่องยนต์",
      methods: "Linear Regression, Polynomial Regression, Support Vector Regression, Decision Tree Regression, Random Forest Regression"
    },
    {
      short: "Used Car Price Prediction and Classification",
      title: "Used Car Price Prediction and Classification Using Machine Learning Approaches",
      author: "Hesham",
      year: "2025",
      best: "XGBoost",
      bestKind: "xgb",
      result: "R² 0.97, MAE 122388.85 และ CNN มีความแม่นยำถึง 94.4%",
      variables: "ชื่อรถ, ปีที่ผลิต, ราคาขาย, ราคามือหนึ่งปัจจุบัน, ระยะทางที่ขับขี่, ประเภทเชื้อเพลิง, ประเภทผู้ขาย, ระบบเกียร์, จำนวนเจ้าของ, รูปภาพรถ",
      methods: "Linear Regression, Random Forest, Gradient Boosting, K-Nearest Neighbors, XGBoost, CNN"
    }
  ],

  dataPrep: {
    n: 46074,
    sources: ["Kaidee.com", "One2Car.com"],
    rules: [
      "ลบข้อมูลซ้ำ",
      "ลบข้อมูลที่มีค่าว่างหรือค่าผิดปกติ",
      "ตัดรุ่นรถที่มีจำนวนน้อยกว่า 50 คัน",
      "อายุรถยนต์ 0-20 ปี, เลขไมล์ไม่เกิน 300,000, ขนาดเครื่องยนต์ 1000–3500 ซีซี และราคาไม่เกิน 2,000,000 บาท"
    ]
  },

  variables: {
    target: "ราคารถยนต์มือสอง (บาท)",
    items: [
      { code: "X1", name: "ประเภทรถยนต์", detail: "Sedan, Hatchback, Pickup, SUV/PPV/MPV, Van", icon: "car" },
      { code: "X2", name: "ยี่ห้อรถยนต์", detail: "HONDA, TOYOTA, MITSUBISHI, ISUZU และอื่นๆ", icon: "brand" },
      { code: "X3", name: "รุ่นรถยนต์", detail: "CIVIC, EVEREST, FORTUNER, ALPHARD และอื่นๆ", icon: "model" },
      { code: "X4", name: "ประเภทเชื้อเพลิง", detail: "Benzine, Diesel, Hybrid/PHEV", icon: "fuel" },
      { code: "X5", name: "ขนาดเครื่องยนต์", detail: "หน่วย ซีซี", icon: "engine" },
      { code: "X6", name: "ระบบเกียร์", detail: "Manual, Automatic", icon: "gear" },
      { code: "X7", name: "ระยะทางที่วิ่งทั้งหมด", detail: "หน่วย กิโลเมตร", icon: "road" },
      { code: "X8", name: "อายุของรถยนต์", detail: "หน่วย ปี", icon: "age" }
    ]
  },

  dt: {
    combos: 87088,
    params: [
      ["max_depth", "10, 15, 20, 25, None", "25"],
      ["min_samples_leaf", "1, 5, 7, 9, 12, 15", "5"],
      ["ccp_alpha", "ทุกค่าจากเส้นทางการตัดแต่งกิ่งของแต่ละคู่", "4.86×10⁵"]
    ],
    top5: [
      ["1", "25", "5", "4.86×10⁵", "57,931", "477"],
      // Notebook v5 is authoritative: slide p20 transposes 57,973 to 57,937.
      ["2", "None", "5", "4.86×10⁵", "57,973", "506"],
      ["3", "25", "1", "1.11×10⁶", "58,208", "654"],
      ["4", "20", "5", "4.86×10⁵", "58,244", "605"],
      ["5", "None", "1", "1.11×10⁶", "58,281", "696"]
    ],
    folds: [
      ["1", "58,647"],
      ["2", "57,724"],
      ["3", "57,315"],
      ["4", "58,298"],
      ["5", "57,673"]
    ],
    mean: { mae: "57,931" },
    cv: [
      ["R-squared", "0.9251", "0.9319"],
      ["MAE (บาท)", "57,931", "56,628"],
      ["RMSE (บาท)", "89,802", "85,630"],
      ["MAPE (%)", "10.97", "10.72"]
    ]
  },

  rf: {
    combos: 42,
    params: [
      ["n_estimators", "50, 100, 150, 200, 300, 400, 600, 800, 1,000", "300"],
      ["max_features", "0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0", "0.3"],
      ["min_samples_leaf", "1, 2, 3, 4, 6, 8", "2"],
      ["max_depth", "None", "None"]
    ],
    oob: {
      labels: ["50", "100", "150", "200", "300", "400", "600", "800", "1000"],
      values: [53180, 52832, 52759, 52707, 52615, 52562, 52524, 52499, 52496],
      markerIndex: 4,
      markerText: "300 ต้น"
    },
    top5: [
      ["1", "0.3", "2", "53,323", "256"],
      ["2", "0.4", "2", "53,369", "272"],
      ["3", "0.5", "2", "53,449", "322"],
      ["4", "0.4", "3", "53,512", "325"],
      ["5", "0.5", "3", "53,514", "364"]
    ],
    folds: [
      ["1", "53,799"],
      ["2", "53,178"],
      ["3", "53,057"],
      ["4", "53,233"],
      ["5", "53,347"]
    ],
    mean: { mae: "53,323" },
    cv: [
      ["R-squared", "0.9396", "0.9431"],
      ["MAE (บาท)", "53,323", "52,275"],
      ["RMSE (บาท)", "80,694", "78,252"],
      ["MAPE (%)", "10.18", "9.98"]
    ]
  },

  xgb: {
    combos: 60,
    params: [
      ["n_estimators", "Early Stopping (สูงสุด 1,000)", "122"],
      ["max_depth", "8, 12, 16, 20, 24", "16"],
      ["min_child_weight", "1, 5, 20", "1"],
      ["reg_lambda", "0, 1, 10, 100", "10"],
      ["learning_rate", "0.1", "0.1"],
      ["subsample", "0.8", "0.8"],
      ["colsample_bytree", "0.8", "0.8"]
    ],
    top5: [
      ["1", "16", "1", "10", "122", "52,256", "533"],
      ["2", "20", "1", "10", "88", "52,331", "519"],
      ["3", "24", "1", "10", "78", "52,356", "518"],
      ["4", "20", "1", "100", "299", "52,430", "325"],
      ["5", "12", "1", "10", "213", "52,448", "446"]
    ],
    folds: [
      ["1", "53,139"],
      ["2", "51,537"],
      ["3", "51,980"],
      ["4", "52,459"],
      ["5", "52,166"]
    ],
    mean: { mae: "52,256" },
    cv: [
      ["R-squared", "0.9423", "0.9458"],
      ["MAE (บาท)", "52,256", "51,271"],
      ["RMSE (บาท)", "78,836", "76,379"],
      ["MAPE (%)", "9.96", "9.74"]
    ]
  },

  comparison: [
    { label: "R-squared", better: "สูงดี", dt: 0.9319, rf: 0.9431, xgb: 0.9458, format: "dec4" },
    { label: "MAE (บาท)", better: "ต่ำดี", dt: 56628, rf: 52275, xgb: 51271, format: "comma" },
    { label: "RMSE (บาท)", better: "ต่ำดี", dt: 85630, rf: 78252, xgb: 76379, format: "comma" },
    { label: "MAPE (%)", better: "ต่ำดี", dt: 10.72, rf: 9.98, xgb: 9.74, format: "dec2" }
  ],

  importance: {
    ranks: [
      { name: "อายุของรถยนต์", dt: 2, rf: 1, xgb: 1 },
      { name: "ขนาดเครื่องยนต์", dt: 1, rf: 2, xgb: 2 },
      { name: "ประเภทของรถยนต์", dt: 3, rf: 3, xgb: 3 },
      { name: "ยี่ห้อรถยนต์", dt: 4, rf: 4, xgb: 4 },
      { name: "รุ่นรถยนต์", dt: 5, rf: 5, xgb: 5 },
      { name: "ประเภทเชื้อเพลิง", dt: 7, rf: 6, xgb: 6 },
      { name: "ระยะทางที่วิ่งทั้งหมด", dt: 6, rf: 7, xgb: 7 },
      { name: "ระบบเกียร์", dt: 8, rf: 8, xgb: 8 }
    ],
    // Keep model outputs: slide p29 swaps DT fuel/mileage and prints gear as 6,601.
    deltas: [
      { name: "ขนาดเครื่องยนต์", dt: 136918, rf: 105699, xgb: 116639 },
      { name: "อายุของรถยนต์", dt: 126353, rf: 112294, xgb: 119874 },
      { name: "ประเภทของรถยนต์", dt: 60853, rf: 45958, xgb: 55720 },
      { name: "ยี่ห้อรถยนต์", dt: 55511, rf: 41524, xgb: 46878 },
      { name: "รุ่นรถยนต์", dt: 41819, rf: 34316, xgb: 34656 },
      { name: "ระยะทางที่วิ่งทั้งหมด", dt: 18539, rf: 21207, xgb: 21027 },
      { name: "ประเภทเชื้อเพลิง", dt: 16336, rf: 22446, xgb: 21473 },
      { name: "ระบบเกียร์", dt: 6606, rf: 8326, xgb: 7639 }
    ],
    models: {
      dt: { label: "Decision Tree", color: "var(--dt)" },
      rf: { label: "Random Forest", color: "var(--rf)" },
      xgb: { label: "XGBoost", color: "var(--xgb)" }
    }
  },

  app: {
    price: 651000,
    priceDisplay: "651,000",
    range: "599,000 – 703,000",
    screens: [
      { src: "assets/app-input1-type.jpg", step: "Input 01", desc: "ประเภทรถ", alt: "หน้าจอเลือกประเภทรถ รถตู้ ซีดาน และแฮทช์แบ็ก" },
      { src: "assets/app-input2-brand.jpg", step: "Input 02", desc: "แบรนด์", alt: "หน้าจอเลือกแบรนด์รถ SUZUKI TOYOTA และ BMW" },
      { src: "assets/app-input3-model.jpg", step: "Input 03", desc: "รุ่น", alt: "หน้าจอเลือกรุ่นรถ YARIS ATIV CAMRY และ COROLLA ALTIS" },
      { src: "assets/app-input4-details.jpg", step: "Input 04", desc: "ข้อมูลรถ", alt: "หน้าจอกรอกข้อมูลรถ ปี 2018 ขนาดเครื่องยนต์ 2000 ซีซี และเลขไมล์ 80000 กิโลเมตร" },
      { src: "assets/app-output-price.jpg", step: "Output ราคา", desc: "ราคาโดยประมาณ", alt: "หน้าจอแสดงราคาโดยประมาณ 651,000 บาท พร้อมช่วงราคาและกราฟราคา 5 ปีข้างหน้า" },
      { src: "assets/app-output-compare.jpg", step: "Output เปรียบเทียบ", desc: "เปรียบเทียบ คัน A / คัน B", alt: "หน้าจอเปรียบเทียบราคารถสองคัน" }
    ],
    note: "โมเดล XGBoost ที่เทรนจากชุดข้อมูล v5 (R² ทดสอบ 0.946, MAE ประมาณ 51,000 บาท)"
  },

  conclusion: {
    mae: 51271,
    percent: 94.58,
    r2: 0.9458,
    rmse: 76379,
    mape: 9.74,
    recommendations: [
      "ราคาจริงเกิดจากการต่อรองระหว่างผู้ซื้อและผู้ขาย",
      "ควรพิจารณาตัวแปรอื่นในการสะท้อนคุณภาพของรถ"
    ]
  }
};

/* Set this to the deployed web app URL to show the "ลองใช้งานจริง" card. */
const APP_URL = "https://putawann.github.io/webapp_car_used/";
