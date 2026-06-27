
let numberEx = Number.prototype;

numberEx.GameFormat = function(){
    if (Math.abs(this) < 100000) {
        return this.SubNumber();//.toLocaleString()
    }
    let value = this;
    var param = {};
    var k = 10000,
        sizes = ['', '万', '亿', '万亿'],
        i;
    if(value < k){
        param["value"] =value
        param["unit"] =''
    }else{
        i = Math.floor(Math.log(value) / Math.log(k));
        if(i>0){
            value = Math.round(value)
        }
        param["value"] = ((value / Math.pow(k, i))).toFixed(2);
        param["unit"] = sizes[i];
    }
    return param["value"] + param["unit"] +""
}
// 保留小数点2位数
numberEx.SubNumber = function(){
    // let xx = Number(parseFloat(a).toFixed(3).slice(0,-1))
    let t = this.toString();
    let index = t.indexOf('.');
    if(index != -1){
        let n = index+3;
        for (let i = 2; i >= 1; i--) {
            if (Number(t[index+i]) == 0) {
                n -= 1
            }
            else{
                break;
            }
        }
        if (n == index + 1) {
            n = index;
        }
        
        t = t.slice(0,n);
    }
    return t
}

numberEx.format0 = function(){
    if (this < 10) {
        return '0'+this;
    }
    return this.toString();
}

const units_en = ["k","B","T"]

numberEx.longNumberFormat = function(){
    num = this
    if (num < 1000)
        return `${Math.floor(num)}`
    else
    {
        let i = 0;
        let mod = 1000;
        while (num >= mod){
            num = num / mod
            i = i + 1
        }
        if(i > 0)
        {
            let num1 = Math.floor(num);
            let num2 = Math.floor(((num - num1) * 10));
            if(num2 >= 1)
            {
                return `${num1}.${num2}${this.units_en[i - 1]}`
            }
            else
                return `${num1}${this.units_en[i - 1]}`
        }
    }
}

numberEx.floor = function(){
    return Math.floor(this);
}