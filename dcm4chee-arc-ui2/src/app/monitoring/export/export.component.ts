import {Component, OnInit, ViewContainerRef} from '@angular/core';
import {SlimLoadingBarService} from "ng2-slim-loading-bar";
import {User} from "../../models/user";
import {Http} from "@angular/http";
import {ConfirmComponent} from "../../widgets/dialogs/confirm/confirm.component";
import {MdDialogConfig, MdDialog, MdDialogRef} from "@angular/material";
import * as _ from "lodash";
import {AppService} from "../../app.service";
import {ExportService} from "./export.service";

@Component({
  selector: 'app-export',
  templateUrl: './export.component.html'
})
export class ExportComponent implements OnInit {
    matches = [];
    user:User;
    exporters;
    exporterID;
    exportTasks = [];
    filters = {
        ExporterID:undefined,
        offset:undefined,
        limit:20,
        status:"*",
        updatedBefore:undefined,
        dicomDeviceName:undefined
    };
    isRole:any;
    dialogRef: MdDialogRef<any>;
    _ = _;

    constructor(public $http: Http, public cfpLoadingBar:SlimLoadingBarService, public mainservice:AppService,public  service:ExportService,public viewContainerRef: ViewContainerRef,public dialog: MdDialog, public config: MdDialogConfig) {
        this.initExporters(1);
        // this.init();
        let $this = this;
        if(!this.mainservice.user){
            // console.log("in if studies ajax");
            this.mainservice.user = this.mainservice.getUserInfo().share();
            this.mainservice.user
                .subscribe(
                    (response) => {
                        $this.user.user  = response.user;
                        $this.mainservice.user.user = response.user;
                        $this.user.roles = response.roles;
                        $this.mainservice.user.roles = response.roles;
                        $this.isRole = (role)=>{
                            if(response.user === null && response.roles.length === 0){
                                return true;
                            }else{
                                if(response.roles && response.roles.indexOf(role) > -1){
                                    return true;
                                }else{
                                    return false;
                                }
                            }
                        };
                    },
                    (response) => {
                        // $this.user = $this.user || {};
                        console.log("get user error");
                        $this.user.user = "user";
                        $this.mainservice.user.user = "user";
                        $this.user.roles = ["user","admin"];
                        $this.mainservice.user.roles = ["user","admin"];
                        $this.isRole = (role)=>{
                            if(role === "admin"){
                                return false;
                            }else{
                                return true;
                            }
                        };
                    }
                );

        }else{
            this.user = this.mainservice.user;
            this.isRole = this.mainservice.isRole;
        }
    };
    filterKeyUp(e){
        let code = (e.keyCode ? e.keyCode : e.which);
        if(code === 13){
            this.search(0);
        }
    };
    confirm(confirmparameters){
        this.config.viewContainerRef = this.viewContainerRef;
        this.dialogRef = this.dialog.open(ConfirmComponent, this.config);
        this.dialogRef.componentInstance.parameters = confirmparameters;
        return this.dialogRef.afterClosed();
    };
    search(offset) {
        let $this = this;
        $this.cfpLoadingBar.start();
        this.service.search(this.filters, offset)
            .map(res => res.json())
            .subscribe((res) => {
                console.log("res2",res);
                console.log("res",res.length);
                if(res && res.length > 0){
                    $this.matches = res.map((properties, index) => {
                        $this.cfpLoadingBar.complete();
                        if(_.hasIn(properties,'Modality')){
                            properties.Modality = properties.Modality.join(',');
                        }
                        return {
                            offset: offset + index,
                            properties: properties,
                            showProperties: false
                        };
                    });
                }else{
                    $this.cfpLoadingBar.complete();
                    $this.matches = [];
                    $this.mainservice.setMessage({
                        "title": "Info",
                        "text": "No tasks found!",
                        "status":'info'
                    });
                }
            }, (err) =>{
                $this.cfpLoadingBar.complete();
                $this.matches = [];
                console.log("err",err);
            });
    };
    getDifferenceTime(starttime,endtime){
        let start = new Date(starttime).getTime();
        let end = new Date(endtime).getTime();
        if(!start || !end || end < start){
            return null;
        }else{
            return this.msToTime(new Date(endtime).getTime() - new Date(starttime).getTime());
        }
    };
    msToTime(duration) {

        if(duration > 999){

            let milliseconds:any = parseInt((((duration%1000))).toString())
                , seconds:any = parseInt(((duration/1000)%60).toString())
                , minutes:any = parseInt(((duration/(1000*60))%60).toString())
                , hours:any = parseInt(((duration/(1000*60*60))).toString());
            if(hours === 0){
                if(minutes === 0){
                    return seconds.toString() + "." + milliseconds.toString() + ' sec';
                }else{
                    seconds = (seconds < 10) ? "0" + seconds : seconds;
                    return minutes.toString() + ":" + seconds.toString() + "." + milliseconds.toString() + ' min';
                }
            }else{

                hours = (hours < 10) ? "0" + hours : hours;
                minutes = (minutes < 10) ? "0" + minutes : minutes;
                seconds = (seconds < 10) ? "0" + seconds : seconds;

                return hours.toString() + ":" + minutes.toString() + ":" + seconds.toString() + "." + milliseconds.toString() + ' h';
            }
        }else{
            return duration.toString() + ' ms';
        }
    }
    delete(match){
        let $this = this;
        let parameters: any = {
            content: 'Are you sure you want to delete this task?',
            result: {
                select:this.exporters[0].id
            },
            saveButton: "DELETE"
        };
        this.confirm(parameters).subscribe(result => {
            if(result){
                $this.cfpLoadingBar.start();
                this.service.delete(match.properties.pk)
                    .subscribe(
                        (res) => {
                            // match.properties.status = 'CANCELED';
                            $this.cfpLoadingBar.complete();
                            $this.search(0);
                            $this.mainservice.setMessage({
                                "title": "Info",
                                "text": "Task deleted successfully!",
                                "status":'info'
                            });
                        },
                        (err) => {
                            $this.cfpLoadingBar.complete();
                            console.log("cancleerr",err);
                            $this.mainservice.setMessage({
                                "title": "Error " + err.status,
                                "text": err.statusText,
                                "status": "error"
                            });
                        });
                }
        });
    }
    cancel(match) {
        let $this = this;
        let parameters: any = {
            content: 'Are you sure you want to cancel this task?',
            result: {
                select:this.exporters[0].id
            },
            saveButton: "CANCEL"
        };
        this.confirm(parameters).subscribe(result => {
            if(result){
                $this.cfpLoadingBar.start();
                this.service.cancel(match.properties.pk)
                    .subscribe(
                        (res) => {
                            match.properties.status = 'CANCELED';
                            $this.cfpLoadingBar.complete();
                            $this.mainservice.setMessage({
                                "title": "Info",
                                "text": "Task canceled successfully!",
                                "status":'info'
                            });
                        },
                        (err) => {
                            $this.cfpLoadingBar.complete();
                            console.log("cancleerr",err);
                            $this.mainservice.setMessage({
                                "title": "Error " + err.status,
                                "text": err.statusText,
                                "status": "error"
                            });
                        });
            }
        });
    };
    reschedule(match) {
        let $this = this;
        let select:any = [];
        _.forEach(this.exporters, (m,i)=>{
            select.push({
                title:m.description,
                value:m.id,
                label:m.id
            });
        });
        let parameters: any = {
            content: 'Are you sure you want to reschedule this task?',
            select: select,
            result: {
                select:this.exporters[0].id
            },
            saveButton: "RESCHEDULE"
        };
        this.confirm(parameters).subscribe(result => {
            if(result){
                $this.cfpLoadingBar.start();
                console.log("resultparam",parameters.result.select);
                this.service.reschedule(match.properties.pk,parameters.result.select)
                    .subscribe(
                        (res) => {
                            $this.search(0);
                            $this.cfpLoadingBar.complete();
                            $this.mainservice.setMessage({
                                "title": "Info",
                                "text": "Task rescheduled successfully!",
                                "status":'info'
                            });
                        },
                        (err) => {
                            $this.cfpLoadingBar.complete();
                            console.log("cancleerr",err);
                            $this.mainservice.setMessage({
                                "title": "Error " + err.status,
                                "text": err.statusText,
                                "status": "error"
                            });
                        });
            }
        });
    };
    ngOnInit() {
    }
    hasOlder(objs) {
        return objs && (objs.length === this.filters.limit);
    };
    hasNewer(objs) {
        return objs && objs.length && objs[0].offset;
    };
    newerOffset(objs) {
        return Math.max(0, objs[0].offset - this.filters.limit);
    };
    olderOffset(objs) {
        return objs[0].offset + this.filters.limit;
    };

/*    init() {
        let $this = this;
        $this.cfpLoadingBar.start();
        this.$http.get("../monitor/export")
            .map(res => res.json())
            .subscribe((res) => {
                $this.exportTasks = res;
                // $this.queueName = res[0].name;
                $this.cfpLoadingBar.complete();
            })
    }*/
    initExporters(retries) {
        let $this = this;
        this.$http.get("../export")
            .map(res => res.json())
            .subscribe(
                (res) => {
                    console.log("res",res);
                    console.log("exporters",$this.exporters);
                    $this.exporters = res;
                    console.log("exporters2",$this.exporters);
                    if(res && res[0] && res[0].id){
                        $this.exporterID = res[0].id;
                    }
                    // $this.mainservice.setGlobal({exporterID:$this.exporterID});
                },
                (res) => {
                    if (retries)
                        this.initExporters(retries-1);
                });
    }
}
