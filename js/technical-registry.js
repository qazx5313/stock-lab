/* Unified technical analysis registry.
 * Existing data sources kept in place:
 * - docs/technical-learning-center.md: learning copy and long-form explanation.
 * - jobs/strategy_center.py: executable strategy definitions and Supabase export.
 * This file is the frontend/helper registry for indicators, patterns, rules, strategies, screeners, and scoring.
 */
(function(root){
  const CANONICAL_ALIASES={
    macd:'macd','平滑異同移動平均線':'macd',
    rsi:'rsi','相對強弱指標':'rsi',
    kd:'kd',stochastic:'kd','隨機指標':'kd',
    'double bottom':'double-bottom','雙底':'double-bottom','w底':'double-bottom',
    'double top':'double-top','雙頂':'double-top','m頭':'double-top',
    '矩形整理':'box-consolidation','區間整理':'box-consolidation','箱型':'box-consolidation',
    'bollinger bands':'bollinger-bands','布林通道':'bollinger-bands',
    ma:'moving-average',sma:'sma','均線':'moving-average'
  };
  const SCORE_RULES={
    weights:{trendScore:.25,volumeScore:.25,patternScore:.2,chipScore:.2,riskScore:-.1},
    formula:'finalScore = trendScore * 0.25 + volumeScore * 0.25 + patternScore * 0.2 + chipScore * 0.2 - riskScore * 0.1',
    grades:[
      {min:85,max:100,label:'強勢多頭觀察'},
      {min:70,max:84,label:'偏多觀察'},
      {min:55,max:69,label:'中性偏多'},
      {min:40,max:54,label:'中性整理'},
      {min:25,max:39,label:'偏弱觀察'},
      {min:0,max:24,label:'高風險避開'}
    ],
    disclaimer:'研究與教學用途，需搭配停損、部位控管與風險管理，不代表保證獲利。'
  };
  const base={
    alias:[],bias:'mixed',description:'',logic:'',formula:'',
    bullishSignals:[],bearishSignals:[],neutralSignals:[],confirmSignals:[],failSignals:[],
    riskNotes:[],suitableMarket:[],unsuitableMarket:[],screenerConditions:[],
    scoreWeight:{trend:0,volume:0,pattern:0,chip:0,risk:0},uiTags:[],explanationTemplate:''
  };
  const normId=v=>String(v||'').trim().toLowerCase().replace(/_/g,'-').replace(/\s+/g,'-');
  const canonicalId=v=>CANONICAL_ALIASES[String(v||'').trim().toLowerCase()]||normId(v);
  const record=o=>({
    ...base,
    ...o,
    id:canonicalId(o.id||o.name),
    alias:[...(o.alias||[])].filter(Boolean),
    uiTags:[...(o.uiTags||[]),o.category,o.type].filter(Boolean),
    explanationTemplate:o.explanationTemplate||`${o.name}：${o.description||'依價格、成交量與位置判斷訊號強弱。'}`
  });
  const indicatorDefaults={
    trend:{
      suitableMarket:['趨勢明確','波段行情','均線方向穩定'],
      unsuitableMarket:['劇烈盤整','跳空雜訊多','成交量過低'],
      confirmSignals:['價格站穩關鍵均線','量能不低於20日均量','大盤方向一致'],
      failSignals:['跌破關鍵均線且站不回','訊號與量能背離'],
      riskNotes:['趨勢指標落後價格，盤整時容易反覆假訊號。'],
      scoreWeight:{trend:18,volume:4,pattern:2,chip:0,risk:4}
    },
    momentum:{
      suitableMarket:['震盪轉強','波段中繼','背離觀察'],
      unsuitableMarket:['無量盤整','急漲急跌後追價'],
      confirmSignals:['動能轉強後價格同步站上壓力','量能配合'],
      failSignals:['動能轉強但價格無法突破','高檔鈍化後跌破支撐'],
      riskNotes:['動能指標可能鈍化，不能單獨當買賣依據。'],
      scoreWeight:{trend:6,volume:4,pattern:4,chip:0,risk:5}
    },
    volatility:{
      suitableMarket:['波動擴張前後','突破或回測策略','停損距離估算'],
      unsuitableMarket:['極低流動性','消息造成跳空失真'],
      confirmSignals:['波動擴張伴隨方向突破','回測不破關鍵線'],
      failSignals:['突破後迅速跌回通道內','波動擴張但成交量不足'],
      riskNotes:['波動率只描述震幅，不直接代表方向。'],
      scoreWeight:{trend:6,volume:6,pattern:8,chip:0,risk:8}
    },
    volume:{
      suitableMarket:['資金行情','突破確認','出貨風險判斷'],
      unsuitableMarket:['成交量失真','除權息或特殊交易日'],
      confirmSignals:['價量同向','成交額同步放大','突破後量縮回測守住'],
      failSignals:['價漲量縮追價','爆量長上影','無量突破'],
      riskNotes:['量能需換算成張數並搭配成交額，避免低價股失真。'],
      scoreWeight:{trend:4,volume:20,pattern:4,chip:0,risk:6}
    }
  };
  const indicator=(id,name,category,formula,extra={})=>record({
    id,name,category,type:'indicator',
    description:extra.description||`${name} 用來觀察${category==='trend'?'趨勢方向':category==='momentum'?'動能強弱':category==='volatility'?'波動變化':'資金參與程度'}。`,
    logic:extra.logic||'以最新值、方向變化、價格位置與成交量確認訊號。',
    formula:formula||'',
    bullishSignals:extra.bullishSignals||['指標轉強且價格站上關鍵位置'],
    bearishSignals:extra.bearishSignals||['指標轉弱且價格跌破關鍵位置'],
    neutralSignals:extra.neutralSignals||['指標在中性區間震盪'],
    screenerConditions:extra.screenerConditions||[`${name} 轉強`,`${name} 與價格同向`],
    alias:extra.alias||[],
    bias:extra.bias||'mixed',
    ...indicatorDefaults[category],
    ...extra
  });
  const TECHNICAL_INDICATORS=[
    indicator('sma','SMA 簡單移動平均','trend','SMA(n)=n日收盤價平均',{alias:['MA','均線'],screenerConditions:['收盤價 > SMA','SMA 向上']}),
    indicator('ema','EMA 指數移動平均','trend','EMA=今日價*K+昨日EMA*(1-K)',{screenerConditions:['收盤價 > EMA','EMA 上彎']}),
    indicator('wma','WMA 加權移動平均','trend','WMA=近期價格給較高權重的加權平均'),
    indicator('hma','HMA 赫爾移動平均','trend','HMA=WMA(2*WMA(n/2)-WMA(n),sqrt(n))',{screenerConditions:['收盤上穿 HMA9','HMA9 上彎']}),
    indicator('vwma','VWMA 成交量加權均線','trend','VWMA=sum(price*volume)/sum(volume)',{alias:['量價均線']}),
    indicator('ma5','MA5 五日線','trend','5日收盤價平均',{alias:['五日線'],bullishSignals:['強勢股沿 MA5 上攻','回測 MA5 不破']}),
    indicator('ma10','MA10 十日線','trend','10日收盤價平均'),
    indicator('ma20','MA20 月線','trend','20日收盤價平均',{alias:['月線'],bullishSignals:['回測 MA20 守住','MA20 向上']}),
    indicator('ma60','MA60 季線','trend','60日收盤價平均',{alias:['季線']}),
    indicator('ma120','MA120 半年線','trend','120日收盤價平均'),
    indicator('ma240','MA240 年線','trend','240日收盤價平均',{alias:['年線']}),
    indicator('macd','MACD','momentum','DIF=EMA12-EMA26；MACD=EMA9(DIF)；OSC=(DIF-MACD)*2',{alias:['平滑異同移動平均線'],bullishSignals:['DIF 上穿 MACD','OSC 翻紅且擴大'],bearishSignals:['DIF 跌破 MACD','OSC 翻黑且擴大'],screenerConditions:['DIF > MACD','OSC 連續增加','收盤站上 MA20']}),
    indicator('adx','ADX 趨向指標','trend','ADX 由 DMI 推導，衡量趨勢強度',{bullishSignals:['ADX 上升且 +DI > -DI'],bearishSignals:['ADX 上升且 -DI > +DI']}),
    indicator('dmi','DMI 方向性指標','trend','+DI 與 -DI 衡量多空方向',{alias:['Directional Movement Index'],bullishSignals:['+DI 上穿 -DI'],bearishSignals:['-DI 上穿 +DI']}),
    indicator('supertrend','Supertrend','trend','以 ATR 建立多空追蹤線',{bullishSignals:['價格站上 Supertrend 線'],bearishSignals:['價格跌破 Supertrend 線']}),
    indicator('parabolic-sar','Parabolic SAR','trend','SAR 隨趨勢加速移動',{alias:['SAR'],bullishSignals:['價格站上 SAR 點位'],bearishSignals:['價格跌破 SAR 點位']}),
    indicator('ichimoku','一目均衡表','trend','轉換線、基準線、先行帶與遲行線',{alias:['Ichimoku'],bullishSignals:['價格站上雲層且轉換線 > 基準線'],bearishSignals:['價格跌破雲層']}),
    indicator('donchian-channel','Donchian Channel','trend','N日最高價與最低價通道',{bullishSignals:['收盤突破上緣'],bearishSignals:['跌破下緣']}),
    indicator('linear-regression','Linear Regression 線性回歸','trend','用回歸線衡量價格趨勢斜率',{bullishSignals:['回歸斜率轉正'],bearishSignals:['回歸斜率轉負']}),
    indicator('rsi','RSI 相對強弱指標','momentum','RSI=100-100/(1+平均漲幅/平均跌幅)',{alias:['相對強弱指標'],bullishSignals:['RSI 站上 50','低檔底背離'],bearishSignals:['RSI 跌破 50','高檔頂背離'],screenerConditions:['RSI > 50','RSI 底背離']}),
    indicator('kd','KD 隨機指標','momentum','RSV=(收盤-9日低)/(9日高-9日低)*100；K/D 平滑',{alias:['Stochastic','隨機指標'],bullishSignals:['低檔 K 上穿 D'],bearishSignals:['高檔 K 下穿 D'],screenerConditions:['KD 低檔黃金交叉']}),
    indicator('cci','CCI 商品通道指標','momentum','CCI=(TP-MA(TP))/(0.015*平均絕對偏差)'),
    indicator('roc','ROC 變動率','momentum','ROC=(今日收盤-N日前收盤)/N日前收盤*100'),
    indicator('momentum','Momentum 動能','momentum','今日收盤 - N日前收盤'),
    indicator('williams-r','Williams %R','momentum','%R=(N日高-收盤)/(N日高-N日低)*-100'),
    indicator('aroon','Aroon','momentum','衡量近期高低點距今時間'),
    indicator('trix','TRIX','momentum','三重 EMA 的變動率'),
    indicator('tsi','TSI 真實強弱指標','momentum','雙重平滑動能 / 雙重平滑絕對動能'),
    indicator('ultimate-oscillator','Ultimate Oscillator','momentum','短中長期買壓加權震盪'),
    indicator('bollinger-bands','布林通道','volatility','中軌=SMA20；上/下軌=中軌±2*標準差',{alias:['Bollinger Bands'],bullishSignals:['收盤突破上軌且放量','下軌止跌反彈'],bearishSignals:['跌破中軌或下軌','上軌長上影失敗'],screenerConditions:['布林收口後突破','收盤突破上軌且量增']}),
    indicator('bbwidth','BBWidth 布林寬度','volatility','(上軌-下軌)/中軌'),
    indicator('atr','ATR 平均真實波幅','volatility','ATR=TR 的 N 日平均',{screenerConditions:['ATR 擴張','停損距離 = ATR 倍數']}),
    indicator('keltner-channel','Keltner Channel','volatility','EMA ± ATR 倍數'),
    indicator('historical-volatility','Historical Volatility 歷史波動率','volatility','報酬率標準差年化'),
    indicator('standard-deviation','Standard Deviation 標準差','volatility','收盤價相對平均值的離散程度',{alias:['STDEV']}),
    indicator('squeeze-momentum','Squeeze Momentum','volatility','布林通道收縮進入 Keltner 後再釋放'),
    indicator('volume','成交量','volume','成交股數換算張數',{alias:['Volume'],bullishSignals:['突破時成交量放大'],bearishSignals:['高檔爆量不漲']}),
    indicator('average-volume','均量','volume','N日平均成交量',{alias:['VMA'],screenerConditions:['成交量 > 20日均量 1.5 倍']}),
    indicator('volume-ratio','量比','volume','今日量 / 20日均量',{screenerConditions:['量比 >= 1.3','量比 <= 0.8 回測']}),
    indicator('obv','OBV 能量潮','volume','上漲日加量、下跌日扣量'),
    indicator('mfi','MFI 資金流量指標','volume','結合典型價格與成交量的 RSI'),
    indicator('vwap','VWAP 成本均線','volume','sum(price*volume)/sum(volume)',{alias:['VWAP 成本線'],bullishSignals:['價格站上 VWAP'],bearishSignals:['價格跌破 VWAP']}),
    indicator('pvt','PVT 價量趨勢','volume','PVT += volume * 漲跌幅'),
    indicator('volume-profile','Volume Profile 成交量分布','volume','依價格區間統計成交量',{bullishSignals:['突破大量成交區上緣'],bearishSignals:['跌破大量成交區下緣']})
  ];
  const candle=(id,name,bias,position,extra={})=>record({
    id,name,category:'candlestick',type:'pattern',bias,
    description:extra.description||`${name} 是 K 線型態，用實體、影線、相對位置與成交量判斷多空力道。`,
    logic:extra.logic||`形成位置以${position}為主，需比較開高低收與前後 K 棒。`,
    bullishSignals:bias==='bullish'?['低檔或支撐附近出現且隔日轉強']:[],
    bearishSignals:bias==='bearish'?['高檔或壓力附近出現且隔日轉弱']:[],
    neutralSignals:bias==='neutral'?['多空猶豫，等待隔日方向']:[],
    confirmSignals:['成交量配合','隔日收盤確認','符合支撐壓力位置'],
    failSignals:['隔日反向吞噬','跌破型態低點或突破型態高點失敗'],
    riskNotes:['K 線型態不能脫離位置與趨勢單獨判斷。'],
    suitableMarket:[position,'支撐壓力明確'],
    screenerConditions:[`${name} 出現`,`位置=${position}`],
    scoreWeight:{pattern:12,volume:4,risk:bias==='bearish'?10:4},
    uiTags:[position,extra.needConfirm?'需隔日確認':'可當日觀察'],
    ...extra
  });
  const CANDLESTICK_PATTERNS=[
    candle('bullish-candle','陽線','bullish','中段',{logic:'收盤價高於開盤價。'}),
    candle('bearish-candle','陰線','bearish','中段',{logic:'收盤價低於開盤價。'}),
    candle('long-bullish-candle','長紅K','bullish','突破區',{logic:'紅 K 實體大於近期平均實體。'}),
    candle('long-bearish-candle','長黑K','bearish','跌破區',{logic:'黑 K 實體大於近期平均實體。'}),
    candle('doji','十字星','neutral','轉折區',{logic:'開盤與收盤接近，影線可長可短。',needConfirm:true}),
    candle('hammer','錘子線','bullish','低檔',{logic:'下影線長、實體小，低檔代表承接。',needConfirm:true}),
    candle('inverted-hammer','倒錘子線','bullish','低檔',{logic:'上影線長、實體小，低檔需隔日站上高點確認。',needConfirm:true}),
    candle('gravestone-doji','墓碑線','bearish','高檔',{logic:'開收接近低點且上影線長。',needConfirm:true}),
    candle('dragonfly-doji','蜻蜓線','bullish','低檔',{logic:'開收接近高點且下影線長。',needConfirm:true}),
    candle('long-upper-shadow','長上影線','bearish','高檔',{logic:'上影線占全 K 棒比例高，代表上方賣壓。'}),
    candle('long-lower-shadow','長下影線','bullish','低檔',{logic:'下影線占全 K 棒比例高，代表下方承接。'}),
    candle('marubozu','光頭光腳K','mixed','突破區',{logic:'上下影線極短，方向依紅黑 K 判斷。'}),
    candle('small-body-candle','小實體K','neutral','盤整區',{logic:'實體小於近期平均，代表觀望。'}),
    candle('gap-candle','跳空K','mixed','缺口區',{logic:'今日低點高於昨高或今日高點低於昨低。'}),
    candle('engulfing','吞噬型態','mixed','轉折區',{logic:'第二根 K 實體包覆前一根實體。',needConfirm:true}),
    candle('harami','孕線','neutral','轉折區',{logic:'第二根 K 實體落在前一根實體內。',needConfirm:true}),
    candle('dark-cloud-cover','烏雲蓋頂','bearish','高檔',{logic:'長紅後開高收黑並跌入前紅 K 實體中段。',needConfirm:true}),
    candle('piercing-line','曙光初現','bullish','低檔',{logic:'長黑後開低收紅並站回前黑 K 中段。',needConfirm:true}),
    candle('three-white-soldiers','紅三兵','bullish','低檔',{logic:'連三根紅 K 逐步墊高，量能溫和。'}),
    candle('three-black-soldiers','黑三兵','bearish','高檔',{logic:'連三根黑 K 逐步走低。'}),
    candle('morning-star','早晨之星','bullish','低檔',{logic:'長黑、小 K、長紅組合，低檔反轉。',needConfirm:true}),
    candle('evening-star','黃昏之星','bearish','高檔',{logic:'長紅、小 K、長黑組合，高檔轉弱。',needConfirm:true}),
    candle('three-crows','三隻烏鴉','bearish','高檔',{logic:'連三根長黑 K，賣壓延續。'}),
    candle('three-candle-run','三連K','mixed','中段',{logic:'連續三根同方向 K 棒，依位置判斷延續或過熱。'}),
    candle('false-breakdown-reversal','假跌破反包','bullish','支撐區',{logic:'跌破支撐後收回，隔日紅 K 反包。',needConfirm:true}),
    candle('false-breakout-reversal','假突破反殺','bearish','壓力區',{logic:'突破壓力後跌回，隔日黑 K 反殺。',needConfirm:true})
  ];
  const chart=(id,name,bias,extra={})=>record({
    id,name,category:'chart-pattern',type:'pattern',bias,
    description:extra.description||`${name} 用價格結構觀察反轉或延續。`,
    logic:extra.logic||'以高低點排列、頸線或整理區上下緣判斷。',
    bullishSignals:extra.bullishSignals||['突破頸線或整理上緣且放量'],
    bearishSignals:extra.bearishSignals||['跌破頸線或整理下緣且放量'],
    confirmSignals:['突破收盤站穩','量能高於20日均量','回測不破'],
    failSignals:['突破後跌回型態內','量能不足','跌破停損位置'],
    riskNotes:['型態完成前只是假設，需等突破或跌破確認。'],
    suitableMarket:['趨勢中繼','反轉初期','盤整收斂後'],
    unsuitableMarket:['消息跳空','流動性不足'],
    screenerConditions:extra.screenerConditions||[`${name} 結構成立`,`突破確認`],
    scoreWeight:{pattern:18,volume:8,trend:6,risk:6},
    explanationTemplate:`${name}：觀察結構、量能、突破/跌破與停損位置，避免把未完成型態當成確認訊號。`,
    ...extra
  });
  const CHART_PATTERNS=[
    chart('double-bottom','W底','bullish',{alias:['雙底','Double Bottom'],logic:'兩個相近低點，中間反彈形成頸線。',screenerConditions:['第二低不破前低或快速收回','突破頸線']}),
    chart('double-top','M頭','bearish',{alias:['雙頂','Double Top'],logic:'兩個相近高點，中間回落形成頸線。'}),
    chart('head-and-shoulders-bottom','頭肩底','bullish',{logic:'左肩、頭、右肩低點排列，突破頸線確認。'}),
    chart('head-and-shoulders-top','頭肩頂','bearish',{logic:'左肩、頭、右肩高點排列，跌破頸線確認。'}),
    chart('triple-bottom','三重底','bullish'),
    chart('triple-top','三重頂','bearish'),
    chart('rounding-bottom','圓底','bullish'),
    chart('rounding-top','圓頂','bearish'),
    chart('v-reversal','V型反轉','bullish'),
    chart('inverted-v-reversal','倒V反轉','bearish'),
    chart('island-reversal','島狀反轉','mixed'),
    chart('wedge-reversal','楔形反轉','mixed'),
    chart('bull-flag','上升旗形','bullish',{logic:'急漲後小幅下斜整理，突破旗面續攻。'}),
    chart('bear-flag','下跌旗形','bearish'),
    chart('pennant','三角旗形','mixed'),
    chart('rectangle-consolidation','矩形整理','neutral',{alias:['箱型','區間整理']}),
    chart('box-consolidation','箱型整理','neutral',{alias:['箱型','矩形整理','區間整理'],logic:'價格在固定上緣與下緣間震盪。',bullishSignals:['收盤突破箱頂且放量'],bearishSignals:['跌破箱底且放量'],screenerConditions:['近20日振幅小於15%','突破箱頂']}),
    chart('base-consolidation','平台整理','neutral'),
    chart('cup-and-handle','杯柄型態','bullish',{alias:['咖啡杯型態'],logic:'圓弧修正後形成柄部，突破杯緣。'}),
    chart('ascending-triangle','上升三角形','bullish'),
    chart('descending-triangle','下降三角形','bearish'),
    chart('symmetrical-triangle','對稱三角形','neutral'),
    chart('rising-wedge','上升楔形','bearish'),
    chart('falling-wedge','下降楔形','bullish')
  ];
  const simpleRule=(id,name,category,bias,extra={})=>record({
    id,name,category,type:'rule',bias,
    description:extra.description||`${name} 是 ${category} 規則，用來判斷訊號品質與風險。`,
    logic:extra.logic||'以價格、成交量、位置或籌碼欄位交叉確認。',
    bullishSignals:extra.bullishSignals||[],
    bearishSignals:extra.bearishSignals||[],
    neutralSignals:extra.neutralSignals||[],
    confirmSignals:extra.confirmSignals||['搭配趨勢、量能與支撐壓力確認'],
    failSignals:extra.failSignals||['隔日反向、跌回關鍵價位或量能不足'],
    riskNotes:extra.riskNotes||['單一規則不可獨立作為結論。'],
    suitableMarket:extra.suitableMarket||['資料完整且流動性足夠'],
    unsuitableMarket:extra.unsuitableMarket||['低流動性或特殊事件'],
    screenerConditions:extra.screenerConditions||[name],
    scoreWeight:extra.scoreWeight||{volume:8,trend:4,pattern:4,chip:0,risk:4},
    ...extra
  });
  const VOLUME_PRICE_RULES=[
    ['price-up-volume-up','價漲量增','bullish'],['price-up-volume-down','價漲量縮','mixed'],['price-down-volume-up','價跌量增','bearish'],['price-down-volume-down','價跌量縮','neutral'],
    ['bottom-volume-spike','低檔爆量','bullish'],['top-volume-spike','高檔爆量','bearish'],['volume-breakout','放量突破','bullish'],['no-volume-breakout','無量突破','risk'],
    ['low-volume-retest','縮量回測','bullish'],['volume-spike-long-upper-shadow','爆量長上影','bearish'],['volume-price-divergence','量價背離','risk'],
    ['low-volume-consolidation','量縮盤整','neutral'],['moderate-volume-expansion','溫和放量','bullish'],['abnormal-volume-spike','異常爆量','risk']
  ].map(([id,name,bias])=>simpleRule(id,name,'volume',bias,{screenerConditions:[`${name}`,bias==='bullish'?'成交量 > 20日均量':'成交量異常']}));
  const SUPPORT_RESISTANCE_RULES=[
    ['previous-high-resistance','前高壓力'],['previous-low-support','前低支撐'],['high-volume-node','大量成交區'],['gap-zone','跳空缺口'],['moving-average-support','均線支撐'],
    ['box-upper-edge','箱型上緣'],['box-lower-edge','箱型下緣'],['neckline','頸線'],['trendline','趨勢線'],['fibonacci-retracement','斐波那契回撤'],
    ['round-number-level','整數關卡'],['limit-up-candle-zone','漲停K高低點'],['main-force-cost-zone','主力成本區'],['vwap-cost-line','VWAP 成本線']
  ].map(([id,name])=>simpleRule(id,name,'support-resistance','mixed',{
    description:`${name} 是常用支撐壓力來源，突破後可能轉支撐，跌破後可能轉壓力。`,
    bullishSignals:['突破後回測不破','支撐附近量縮止跌'],
    bearishSignals:['跌破後反彈站不回','壓力附近長上影'],
    failSignals:['跌破支撐且放量','突破壓力後隔日跌回'],
    explanationTemplate:`${name}：觀察形成來源、有效支撐/壓力、突破後轉換與失效條件。`
  }));
  const CHIP_RULES=[
    ['foreign-continuous-buy','外資連買'],['investment-trust-continuous-buy','投信連買'],['dealer-net-buy-sell','自營商買賣超'],['institutional-total','三大法人合計'],
    ['main-force-net-buy','主力買超'],['broker-concentrated-buy','分點集中買超'],['broker-concentrated-sell','分點集中賣超'],['margin-balance','融資餘額'],
    ['short-balance','融券餘額'],['short-margin-ratio','券資比'],['securities-lending-sell','借券賣出'],['day-trading-ratio','當沖比'],
    ['turnover-rate','週轉率'],['large-holder-ratio','大戶持股'],['thousand-lot-holders','千張大戶'],['director-supervisor-holding','董監持股'],['tdcc-holder-distribution','集保戶股權分散']
  ].map(([id,name])=>simpleRule(id,name,'chip','mixed',{
    type:'rule',
    bullishSignals:[`${name} 轉強或連續改善`],
    bearishSignals:[`${name} 轉弱或連續惡化`],
    neutralSignals:['籌碼變化不明顯'],
    riskNotes:['籌碼資料有時間落差，需搭配價格與量能。'],
    suitableMarket:['波段資金行情','法人主導類股'],
    screenerConditions:[`${name} 近3日轉強`],
    scoreWeight:{chip:16,trend:2,volume:4,risk:4},
    uiTags:['籌碼','台股']
  }));
  const strategy=(id,name,strategyType,entry,exit,extra={})=>record({
    id,name,category:'strategy',type:'strategy',strategyType,bias:extra.bias||'mixed',
    description:extra.description||`${name} 是 ${strategyType} 類策略模板。`,
    logic:entry.join('；'),
    entryConditions:entry,exitConditions:exit,
    stopLossRules:extra.stopLossRules||['跌破型態低點、關鍵支撐或策略失效價位'],
    takeProfitRules:extra.takeProfitRules||['接近前高、量價背離或報酬風險比達標時分批'],
    confirmSignals:extra.confirmSignals||['成交量確認','大盤不轉弱','隔日站穩'],
    failSignals:extra.failSignals||['假突破','跌破停損','量能不足'],
    suitableMarket:extra.suitableMarket||['趨勢明確或整理末端'],
    unsuitableMarket:extra.unsuitableMarket||['流動性不足','大盤急跌'],
    screenerConditions:extra.screenerConditions||entry,
    scoringWeights:extra.scoringWeights||{trendScore:25,volumeScore:25,patternScore:20,chipScore:20,riskScore:10},
    scoreWeight:{trend:10,volume:10,pattern:10,chip:6,risk:8},
    explanationTemplate:`${name}：進場看 ${entry.join('、')}；出場看 ${exit.join('、')}，僅供研究。`,
    ...extra
  });
  const STRATEGY_TEMPLATES=[
    strategy('volume-breakout-strategy','放量突破','breakout',['收盤突破壓力','成交量 > 20日均量1.3倍'],['跌回突破價下方']),
    strategy('box-breakout-strategy','箱型突破','breakout',['近20日箱型整理','收盤突破箱頂','放量'],['跌回箱頂下方']),
    strategy('base-breakout-strategy','平台突破','breakout',['平台整理完成','突破平台上緣'],['跌回平台內']),
    strategy('previous-high-breakout-strategy','前高突破','breakout',['收盤突破前高','量能放大'],['跌回前高下方']),
    strategy('all-time-high-breakout-strategy','歷史新高突破','breakout',['創歷史或長期新高','成交額放大'],['跌回突破K低點']),
    strategy('bollinger-squeeze-breakout-strategy','布林收口突破','breakout',['BBWidth 低檔','收盤突破上軌'],['跌回中軌']),
    strategy('triangle-breakout-strategy','三角收斂突破','breakout',['高低點收斂','突破收斂上緣'],['跌回三角內']),
    strategy('cup-handle-breakout-strategy','杯柄突破','breakout',['杯柄完成','突破杯緣'],['跌破柄部低點']),
    strategy('limit-up-breakout-strategy','漲停突破','breakout',['漲停K後整理','突破漲停K高點'],['跌破漲停K低點']),
    strategy('ma-compression-breakout-strategy','均線糾結突破','breakout',['MA5/10/20 糾結','放量突破'],['跌破糾結區']),
    strategy('breakout-retest-hold-strategy','突破後回測不破','retest',['突破後拉回','回測突破價不破'],['跌破突破價']),
    strategy('ma5-retest-strategy','五日線回測','retest',['強勢股回測 MA5','量縮止跌'],['跌破 MA5 且站不回']),
    strategy('ma20-retest-strategy','月線回測','retest',['回測 MA20','量縮紅K'],['放量跌破 MA20']),
    strategy('gap-retest-strategy','缺口回測','retest',['回測跳空缺口上緣','缺口不補'],['補缺口且轉弱']),
    strategy('neckline-retest-strategy','頸線回測','retest',['突破頸線後回測','頸線守住'],['跌破頸線']),
    strategy('box-top-retest-strategy','箱頂回測','retest',['突破箱頂後回測','箱頂轉支撐'],['跌回箱內']),
    strategy('vwap-retest-strategy','VWAP 回測','retest',['價格站上 VWAP','回測 VWAP 不破'],['跌破 VWAP']),
    strategy('limit-up-candle-retest-strategy','漲停K回測','retest',['回測漲停K高低點區間','量縮止跌'],['跌破漲停K低點']),
    strategy('double-bottom-reversal-strategy','W底反轉','reversal',['第二低不破','突破頸線'],['跌破第二低']),
    strategy('head-shoulders-bottom-reversal-strategy','頭肩底反轉','reversal',['頭肩底完成','突破頸線'],['跌破右肩低點']),
    strategy('rsi-bullish-divergence-strategy','RSI底背離','reversal',['價格創低 RSI 未創低','站回短均'],['跌破新低']),
    strategy('macd-bullish-divergence-strategy','MACD底背離','reversal',['價格創低 MACD 未創低','OSC 改善'],['OSC 再轉弱']),
    strategy('kd-low-golden-cross-strategy','KD低檔黃金交叉','reversal',['KD 低檔 K 上穿 D','價格止跌'],['K 再跌破 D']),
    strategy('long-lower-shadow-reversal-strategy','長下影止跌','reversal',['支撐附近長下影','隔日站穩'],['跌破下影低點']),
    strategy('bottom-volume-reversal-strategy','低檔爆量反轉','reversal',['低檔爆量紅K','隔日不破低點'],['爆量後續跌']),
    strategy('oversold-rebound-strategy','跌深反彈','reversal',['跌幅過大','RSI過低後轉強'],['反彈量縮失敗']),
    strategy('ma-bull-trend-strategy','均線多頭排列','trend-following',['MA5>MA10>MA20>MA60','價格站上均線'],['均線反轉或跌破 MA20']),
    strategy('macd-trend-red-bar-strategy','MACD順勢紅柱','trend-following',['DIF>MACD','OSC 紅柱擴大'],['OSC 縮小轉黑']),
    strategy('adx-trend-strength-strategy','ADX趨勢增強','trend-following',['ADX 上升','方向指標同向'],['ADX 下降且跌破均線']),
    strategy('supertrend-bull-strategy','Supertrend多頭','trend-following',['價格站上 Supertrend','線向上'],['跌破 Supertrend']),
    strategy('ma5-strong-trend-strategy','強勢股沿五日線','trend-following',['沿 MA5 上攻','回測不破'],['跌破 MA5 站不回']),
    strategy('flag-continuation-strategy','旗形整理後續攻','trend-following',['急漲後旗形整理','突破旗面'],['跌破旗形低點']),
    strategy('n-wave-trend-strategy','N字型上攻','trend-following',['高低點墊高','突破前高'],['跌破前低']),
    strategy('box-bottom-range-strategy','箱底低吸','range',['箱底支撐','量縮止跌'],['跌破箱底']),
    strategy('box-top-range-strategy','箱頂高賣','range',['接近箱頂壓力','量價背離'],['突破箱頂放量']),
    strategy('bollinger-band-range-strategy','布林上下軌反轉','range',['觸及上下軌','動能反轉'],['通道擴張順勢突破']),
    strategy('rsi-range-strategy','RSI過熱過冷','range',['RSI 過熱/過冷','價格接近支撐壓力'],['趨勢行情鈍化']),
    strategy('kd-range-cycle-strategy','KD高低檔循環','range',['KD 高低檔交叉','區間明確'],['突破區間後失效']),
    strategy('support-resistance-range-strategy','支撐壓力來回','range',['支撐買盤','壓力賣壓'],['區間突破或跌破']),
    strategy('top-volume-upper-shadow-risk','高檔爆量長上影','risk-avoid',['高檔爆量','長上影'],['降低追價']),
    strategy('ma20-break-risk','跌破月線站不回','risk-avoid',['跌破 MA20','反彈站不回'],['轉弱避開']),
    strategy('false-breakout-risk','假突破隔日轉弱','risk-avoid',['突破後隔日轉弱','跌回壓力下'],['避開追價']),
    strategy('margin-surge-risk','融資暴增','risk-avoid',['融資快速增加','股價高檔'],['籌碼風險升高']),
    strategy('institutional-selling-risk','法人連賣','risk-avoid',['法人連續賣超','跌破支撐'],['降低權重']),
    strategy('disposition-risk','處置風險','risk-avoid',['波動過大可能處置','流動性異常'],['降低槓桿']),
    strategy('liquidity-risk','流動性不足','risk-avoid',['成交量 < 1000張','買賣價差大'],['排除候選']),
    strategy('gap-up-fade-risk','跳空開高走低','risk-avoid',['跳空開高','收盤走低長黑'],['避免追高'])
  ];
  const screener=(id,name,category,conditions,extra={})=>record({
    id,name,category,type:'screener',bias:extra.bias||'mixed',
    description:extra.description||`${name} 用於把技術條件轉成股票清單。`,
    requiredDataFields:extra.requiredDataFields||['daily_prices.close','daily_prices.volume','daily_signals.final_score'],
    conditions,optionalConditions:extra.optionalConditions||[],excludeConditions:extra.excludeConditions||['成交量不足','資料缺漏','處置或異常風險'],
    scoreWeights:extra.scoreWeights||{trendScore:25,volumeScore:25,patternScore:20,chipScore:20,riskScore:10},
    outputTags:extra.outputTags||[name],
    screenerConditions:conditions,
    explanationTemplate:extra.explanationTemplate||`${name}：符合 ${conditions.join('、')}，仍需人工確認風險。`
  });
  const SCREENERS=[
    screener('strong-stock-screener','強勢股篩選','trend',['成交量 >= 1000張','站上 MA20/MA60','MA5 > MA10 > MA20 > MA60','20MA 上升']),
    screener('volume-breakout-screener','放量突破篩選','volume',['前日未突破20日高','今日收盤剛突破20日高','量比 >= 1.3','成交量 >= 1000張']),
    screener('ma-compression-breakout-screener','均線糾結突破篩選','trend',['前一日 MA5/10/20 糾結 <= 2.8%','今日站上糾結區','量比 >= 1.2','成交量 >= 1000張']),
    screener('low-volume-retest-screener','量縮回測篩選','volume',['回測 MA20 守住','最近3日量能遞減','成交量低於20日均量8成','非放量急拉']),
    screener('limit-up-consolidation-screener','一個月內漲停後整理篩選','chart-pattern',['近20日有漲停K','整理不破漲停K低點','整理振幅 <= 18%','量能未失控']),
    screener('box-breakout-screener','箱型整理突破篩選','chart-pattern',['前20日箱型振幅 <= 12%','前日仍在箱內','今日剛突破箱頂','量比 >= 1.15']),
    screener('triangle-breakout-screener','三角收斂突破篩選','chart-pattern',['高點降低','低點墊高','前日未突破收斂上緣','今日剛突破收斂上緣']),
    screener('double-bottom-screener','W底反轉篩選','chart-pattern',['兩個低點相近','低點間隔足夠','前日未突破頸線','今日剛突破頸線']),
    screener('head-shoulders-bottom-screener','頭肩底反轉篩選','chart-pattern',['頭低於兩肩','左右肩接近','前日未突破頸線','今日剛突破頸線']),
    screener('macd-turn-screener','MACD轉強篩選','momentum',['OSC 由綠翻紅','DIF 站上慢線','收盤站上 MA20']),
    screener('rsi-divergence-screener','RSI底背離篩選','momentum',['價格低點不高於前低','RSI 低點墊高','RSI 位於低檔區','收盤轉強']),
    screener('chip-turn-screener','法人籌碼轉強篩選','chip',['近3筆法人買超轉正','最近2筆連續買超','前段籌碼未延續買超']),
    screener('main-force-wash-screener','主力洗盤後轉強篩選','chip',['盤中跌破20日支撐','收盤重新站回支撐','長下影收回','量能未失控']),
    screener('false-breakout-risk-screener','假突破風險篩選','risk',['盤中突破20日高','收盤跌回壓力下','長上影','量比 >= 1.1'],{bias:'risk'}),
    screener('top-distribution-risk-screener','高檔出貨風險篩選','risk',['接近60日高檔','量比 >= 1.4','長上影','收盤偏弱'],{bias:'risk'})
  ];
  function dedupe(records){
    const out=new Map();
    records.forEach(r=>{
      const id=canonicalId(r.id||r.name);
      if(!out.has(id)){out.set(id,record({...r,id}));return;}
      const prev=out.get(id);
      out.set(id,{
        ...prev,...r,id,
        alias:[...new Set([...(prev.alias||[]),...(r.alias||[])])],
        uiTags:[...new Set([...(prev.uiTags||[]),...(r.uiTags||[])])],
        bullishSignals:[...new Set([...(prev.bullishSignals||[]),...(r.bullishSignals||[])])],
        bearishSignals:[...new Set([...(prev.bearishSignals||[]),...(r.bearishSignals||[])])],
        screenerConditions:[...new Set([...(prev.screenerConditions||[]),...(r.screenerConditions||[])])]
      });
    });
    return [...out.values()];
  }
  const TECHNICAL_KNOWLEDGE=dedupe([
    ...TECHNICAL_INDICATORS,
    ...CANDLESTICK_PATTERNS,
    ...CHART_PATTERNS,
    ...VOLUME_PRICE_RULES,
    ...SUPPORT_RESISTANCE_RULES,
    ...CHIP_RULES,
    ...STRATEGY_TEMPLATES,
    ...SCREENERS,
    record({id:'technical-score-rule',name:'AI 技術評分規則',category:'strategy',type:'rule',bias:'mixed',description:'整合趨勢、量價、型態、籌碼與風險分數。',logic:SCORE_RULES.formula,scoreWeight:{trend:25,volume:25,pattern:20,chip:20,risk:10},uiTags:['AI評分','研究用途']})
  ]);
  function getAllTechnicalKnowledge(){return TECHNICAL_KNOWLEDGE.slice();}
  function findTechnicalKnowledgeById(id){const k=canonicalId(id);return TECHNICAL_KNOWLEDGE.find(x=>x.id===k)||null;}
  function findTechnicalKnowledgeByCategory(category){return TECHNICAL_KNOWLEDGE.filter(x=>x.category===category);}
  function findTechnicalKnowledgeByType(type){return TECHNICAL_KNOWLEDGE.filter(x=>x.type===type);}
  function searchTechnicalKnowledge(keyword){
    const q=String(keyword||'').trim().toLowerCase();
    if(!q) return [];
    const k=canonicalId(q);
    return TECHNICAL_KNOWLEDGE.filter(x=>[
      x.id,x.name,x.category,x.type,x.description,x.logic,...(x.alias||[]),...(x.uiTags||[])
    ].some(v=>String(v||'').toLowerCase().includes(q) || canonicalId(v)===k));
  }
  function getStrategiesByType(type){return STRATEGY_TEMPLATES.filter(x=>!type || x.strategyType===type || x.category===type);}
  function getScreenersByCategory(category){return SCREENERS.filter(x=>!category || x.category===category);}
  function scoreGrade(score){
    const n=Math.max(0,Math.min(100,Number(score)||0));
    return SCORE_RULES.grades.find(g=>n>=g.min&&n<=g.max)||SCORE_RULES.grades[SCORE_RULES.grades.length-1];
  }
  function calculateTechnicalScore(input={}){
    const n=k=>Math.max(0,Math.min(100,Number(input[k])||0));
    const w=SCORE_RULES.weights;
    const finalScore=Math.max(0,Math.min(100,Math.round(
      n('trendScore')*w.trendScore+n('volumeScore')*w.volumeScore+n('patternScore')*w.patternScore+n('chipScore')*w.chipScore+n('riskScore')*w.riskScore
    )));
    return {finalScore,grade:scoreGrade(finalScore).label,formula:SCORE_RULES.formula,disclaimer:SCORE_RULES.disclaimer};
  }
  function buildTechnicalExplanation(result={}){
    const item=result.id?findTechnicalKnowledgeById(result.id):null;
    const name=result.name||item&&item.name||'技術訊號';
    const score=result.finalScore!=null?`，評分 ${result.finalScore}（${scoreGrade(result.finalScore).label}）`:'';
    const note=item&&item.explanationTemplate?item.explanationTemplate:`${name} 需搭配趨勢、量能、型態與風險確認。`;
    return `${note}${score}。${SCORE_RULES.disclaimer}`;
  }
  const api={
    TECHNICAL_KNOWLEDGE,TECHNICAL_INDICATORS,CANDLESTICK_PATTERNS,CHART_PATTERNS,
    VOLUME_PRICE_RULES,SUPPORT_RESISTANCE_RULES,CHIP_RULES,STRATEGY_TEMPLATES,SCREENERS,
    TECHNICAL_SCORE_RULES:SCORE_RULES,
    getAllTechnicalKnowledge,findTechnicalKnowledgeById,findTechnicalKnowledgeByCategory,
    findTechnicalKnowledgeByType,searchTechnicalKnowledge,getStrategiesByType,getScreenersByCategory,
    buildTechnicalExplanation,calculateTechnicalScore
  };
  Object.assign(root,api);
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
