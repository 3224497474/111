
interface Date {
    // let date = new Date(this.SunActivity.endTime);
    // let date = Date.now();
    // //Public.log("date:",date,date.toDateString(),date.toLocaleString(),date.toTimeString());
    // // .format("yyyy-MM-dd HH:mm:ss"); var time2 = new Date().format("yyyy-MM-dd");
    // //Public.log(date.format("YYYY-mm-dd HH:MM"),date.format("YYYY年mm月dd日 HH:MM"));
    format(str: string): string;
}

interface Number {
    GameFormat(): string;
    longNumberFormat(): string;
    SubNumber(): number;
    floor(): number;
    format0(): string;
}

