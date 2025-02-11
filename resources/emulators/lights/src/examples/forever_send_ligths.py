import time
import requests
import json
import random

def getRandomSingleCommand():
    #ids = ["1", "2", "3", "4", "5", "6",  "7", "8", "9", "10", "11", "12", "13", "14", "15", "11", "12", "13"]
        

    data = dict(session='main', id=random.choice(range(1, 26)).__str__(), color=[255, 0, 0])

    return data

def foreverSingleEvent():
    while True:


        print("Sending Single")

        URL = "http://192.168.0.157:8000/setcolor"

        
        data = getRandomSingleCommand()
        print(data)
        r = requests.post(url = URL, data = json.dumps(data)) 
    
        # extracting response text  
        body = r.text 

        print("The response is:%s"%body) 
        time.sleep(0.001)


def completeColor():
    

    print("Sending Single")

    URL = "http://192.168.0.157:8000/setcolor"

    for id in range(1, 25):
    
        r = requests.post(url = URL, data = dict(session="main", id="%s"%(id,), color=[255,0,0])) 
    
        # extracting response text  
        body = r.text 

        print("The response is:%s"%body) 
        #time.sleep(0.001)


def blackout():
    URL = "https://ci-lights.azurewebsites.net/blackout"

        
    r = requests.post(url = URL, data = json.dumps(
        dict(session='main')
    )) 

    # extracting response text  
    body = r.text 

    print("The response is:%s"%body) 

def testOneToOne():
    while True:



        URL = "http://192.168.1.157:8000/setcolor"

        
        for i in range(1, 25):

            print("Sending Single", i)

            r = requests.post(url = URL, data = json.dumps(
                dict(session='test', id=i.__str__(), color=[255,0,0])
            )) 
        
            time.sleep(0.1)

            #r = requests.post(url = URL, data = json.dumps(
            #    dict(session='test', id=i.__str__(), color=[0,0,0])
            #)) 
        
            # extracting response text  
            body = r.text 

            print("The response is:%s"%body) 


def foreverBulk():
    while True:


        print("Sending Bulk")

        URL = "http://localhost:8000/setbulk"

        
        data =dict(session='test', set=[getRandomSingleCommand() for _ in range(random.randint(1, 5))])

        r = requests.post(url = URL, data = json.dumps(data)) 
    
        # extracting response text  
        body = r.text 

        print("The response is:%s"%body) 
        time.sleep(3)

#blackout()
#completeColor()
foreverSingleEvent()